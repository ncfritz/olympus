import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "../../store/prisma";
import type { Principal } from "../../auth/principal";
import moment from "moment";
import type { AuditEvent, ListAuditEventsQuery } from "../../model/audit";
import { PrismaService } from "../../store/PrismaService";
import type { AuditKindName } from "../auditKinds";
import {
  type AuditActorName,
  type AuditGroupName,
  byActor,
  groupOf,
  inGroups,
  isSensitive,
  sensitiveOnly,
} from "../auditGroups";
import { GENESIS_HASH, hashEvent } from "../auditHash";
import { subjectNamesOf } from "../subjectNames";

export type AuditRecord = {
  kind: AuditKindName;
  principal: Principal;
  subjectType?: string;
  subjectId?: string;
  reason?: string;
  attributes?: Record<string, string | number | boolean | undefined>;
};

export type AuditVerification = {
  events: number;
  valid: boolean;
  /** The first event whose hash or link does not hold. */
  brokenAt?: bigint;
};

/** Serialises writers so the chain has one head: pg_advisory_xact_lock. */
const AUDIT_LOCK = 20_020_020;
const BATCH = 1000;

/**
 * The audit log: append-only (a trigger refuses updates and deletes) and
 * hash-chained, so a change to any event shows at `verify`.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an event. Pass the transaction the audited change happens in,
   * so the event exists exactly when the change does.
   */
  async record(
    event: AuditRecord,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (tx) return this.append(tx, event);
    await this.prisma.$transaction((inner) => this.append(inner, event));
  }

  private async append(
    tx: Prisma.TransactionClient,
    event: AuditRecord,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK})`;
    const head = await tx.auditEvent.findFirst({
      orderBy: { sequence: "desc" },
      select: { hash: true },
    });
    const attributes = Object.fromEntries(
      Object.entries(event.attributes ?? {})
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => [name, String(value)]),
    );
    const fields = {
      previousHash: head?.hash ?? GENESIS_HASH,
      occurredAt: new Date(),
      kind: event.kind,
      principal: event.principal.id,
      surface: event.principal.surface,
      subjectType: event.subjectType ?? null,
      subjectId: event.subjectId ?? null,
      reason: event.reason ?? null,
    };
    await tx.auditEvent.create({
      data: {
        ...fields,
        hash: hashEvent({ ...fields, attributes }),
        attributes: {
          create: Object.entries(attributes).map(([name, value]) => ({
            name,
            value,
          })),
        },
      },
    });
  }

  /** Walks the chain from the first event, recomputing every hash. */
  async verify(): Promise<AuditVerification> {
    let previousHash = GENESIS_HASH;
    let after: bigint | undefined;
    let events = 0;
    for (;;) {
      const batch = await this.prisma.auditEvent.findMany({
        where: after === undefined ? {} : { sequence: { gt: after } },
        orderBy: { sequence: "asc" },
        take: BATCH,
        include: { attributes: true },
      });
      for (const event of batch) {
        const expected = hashEvent({
          previousHash,
          occurredAt: event.occurredAt,
          kind: event.kind,
          principal: event.principal,
          surface: event.surface,
          subjectType: event.subjectType,
          subjectId: event.subjectId,
          reason: event.reason,
          attributes: Object.fromEntries(
            event.attributes.map((a) => [a.name, a.value]),
          ),
        });
        if (event.previousHash !== previousHash || event.hash !== expected) {
          return { events, valid: false, brokenAt: event.sequence };
        }
        previousHash = event.hash;
        events += 1;
      }
      if (batch.length < BATCH) return { events, valid: true };
      after = batch[batch.length - 1].sequence;
    }
  }

  /** The model's shape of `list`, from its query. */
  async listEvents(query: ListAuditEventsQuery): Promise<AuditEvent[]> {
    let before: bigint | undefined;
    if (query.before !== undefined) {
      if (!/^\d+$/.test(query.before)) {
        throw new BadRequestException("before is an event sequence");
      }
      before = BigInt(query.before);
    }
    const rows = await this.list({
      kind: query.kind,
      principal: query.principal,
      subjectType: query.subjectType,
      subjectId: query.subjectId,
      before,
      limit: query.pageSize ?? 100,
      groups: query.groups?.split(",") as AuditGroupName[] | undefined,
      actor: query.actor,
      surface: query.surface,
      sensitive: query.sensitive === "true",
      since: query.since ? new Date(query.since) : undefined,
      search: query.search?.trim() || undefined,
    });
    const names = await subjectNamesOf(this.prisma, rows);
    return rows.map((row) => ({
      sequence: row.sequence.toString(),
      occurredAt: moment(row.occurredAt),
      kind: row.kind,
      group: groupOf(row.kind),
      sensitive: isSensitive(row.kind),
      principal: row.principal,
      surface: row.surface,
      subjectType: row.subjectType ?? undefined,
      subjectId: row.subjectId ?? undefined,
      subjectName: names.get(`${row.subjectType}:${row.subjectId}`),
      reason: row.reason ?? undefined,
      attributes: row.attributes
        .map((a) => ({ name: a.name, value: a.value }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      hash: row.hash,
    }));
  }

  list(filter: {
    kind?: string;
    principal?: string;
    subjectType?: string;
    subjectId?: string;
    before?: bigint;
    limit: number;
    groups?: AuditGroupName[];
    actor?: AuditActorName;
    surface?: string;
    sensitive?: boolean;
    since?: Date;
    search?: string;
  }) {
    const and: Prisma.AuditEventWhereInput[] = [];
    if (filter.groups?.length) and.push(inGroups(filter.groups));
    if (filter.actor) and.push(byActor(filter.actor));
    if (filter.sensitive) and.push(sensitiveOnly);
    if (filter.search) {
      const contains = {
        contains: filter.search,
        mode: "insensitive",
      } as const;
      and.push({
        OR: [
          { kind: contains },
          { principal: contains },
          { subjectId: contains },
          { reason: contains },
          { attributes: { some: { value: contains } } },
        ],
      });
    }
    return this.prisma.auditEvent.findMany({
      where: {
        kind: filter.kind,
        principal: filter.principal,
        subjectType: filter.subjectType,
        subjectId: filter.subjectId,
        surface: filter.surface,
        ...(filter.since ? { occurredAt: { gte: filter.since } } : {}),
        ...(filter.before === undefined
          ? {}
          : { sequence: { lt: filter.before } }),
        ...(and.length ? { AND: and } : {}),
      },
      orderBy: { sequence: "desc" },
      take: filter.limit,
      include: { attributes: true },
    });
  }

  /**
   * Every event of the last `days`, oldest first, as the activity graphs
   * draw them: what, when, by whom, and whether it is sensitive.
   */
  async activity(days: number, now = new Date()) {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.auditEvent.findMany({
      where: { occurredAt: { gte: since } },
      orderBy: { sequence: "asc" },
      select: {
        sequence: true,
        occurredAt: true,
        kind: true,
        surface: true,
        principal: true,
      },
    });
    return {
      since,
      points: rows.map((row) => ({
        ...row,
        group: groupOf(row.kind),
        sensitive: isSensitive(row.kind),
      })),
    };
  }
}
