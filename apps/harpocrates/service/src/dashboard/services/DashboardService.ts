import { Injectable } from "@nestjs/common";
import type {
  AttentionKindName,
  AttentionSeverityName,
  AttentionSubjectName,
  RenewalModeName,
  RenewerName,
  CertificateHealthName,
} from "../../model/dashboard";
import {
  healthOf,
  renewalDueAt,
  renewedOverMtls,
  renewerOf,
  URGENT_DAYS,
} from "../../certificates/renewal";
import { subjectNamesOf } from "../../audit/subjectNames";
import { issuingWindowClosesAt } from "../../issuers/issuingWindow";
import { PrismaService } from "../../store/PrismaService";
import type { IssuerTier, Prisma } from "../../store/prisma";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** How far back the expired certificates in the list go. */
export const EXPIRED_DAYS = 365;

/** How far ahead the expiring certificates look. */
export const EXPIRING_DAYS = 90;

/** An offline CA's list or responder is due a ceremony this far ahead. */
const CEREMONY_DAYS = 60;

/** A deployment waiting this long is failing (the alert's threshold). */
const DEPLOYMENT_FAILING_MS = HOUR;

/** A list waiting this long to be published is failing. */
const UNPUBLISHED_MS = 5 * 60 * 1000;

/** How many audit events the dashboard shows. */
const RECENT_EVENTS = 12;

/** How many days of activity the dashboard charts. */
export const ACTIVITY_DAYS = 90;

export type ExpiringRow = {
  certificateId: string;
  name: string;
  issuerId: string;
  profileId?: string;
  notAfter: Date;
  renewalDueAt: Date;
  renewal: RenewalModeName;
  renewer: RenewerName;
};

export type CertificateRow = ExpiringRow & {
  names: string[];
  serial: string;
  profileVersion?: number;
  notBefore: Date;
  issuedAt: Date;
  renewed: boolean;
  health: CertificateHealthName;
};

export type AttentionRow = {
  kind: AttentionKindName;
  severity: AttentionSeverityName;
  subjectType: AttentionSubjectName;
  subjectId: string;
  title: string;
  detail: string;
  dueAt?: Date;
};

export type CrlRow = {
  issuerId: string;
  tier: IssuerTier;
  offline: boolean;
  number?: bigint;
  nextUpdate?: Date;
  publishedAt?: Date;
  ocspResponderUntil?: Date;
  ocspInCeremony?: boolean;
  ocspSoonestLapse?: Date;
  revoked: number;
  valid: number;
  expired: number;
};

export type DashboardRow = {
  asOf: Date;
  certificates: {
    valid: number;
    issuers: number;
    dueWithin30Days: number;
    dueManual: number;
    expiredRecently: number;
    expiredNames: string[];
    revoked: number;
    revokedThisWeek: number;
  };
  counts: {
    cas: number;
    offlineCas: number;
    sshValid: number;
    sshUser: number;
    sshHost: number;
    profiles: number;
  };
  health: {
    healthy: number;
    renewing: number;
    needsPerson: number;
    failing: number;
  };
  renewers: Record<RenewerName, number>;
  activity: { day: string; issued: number; renewed: number; revoked: number }[];
  certificateList: CertificateRow[];
  attention: AttentionRow[];
  authorities: CrlRow[];
  week: {
    issued: number;
    renewals: number;
    acmeOrders: number;
    acmeOrdersFailed: number;
    deployed: number;
    deploymentsFailing: number;
  };
  ocsp: { answering: number; missingOnline: number; soonestLapse?: Date };
  recent: {
    sequence: bigint;
    occurredAt: Date;
    kind: string;
    principal: string;
    surface: string;
    subjectType?: string;
    subjectId?: string;
    subjectName?: string;
  }[];
  handled: { kind: string; surface: string; count: number }[];
  ca: {
    lastPublishedAt?: Date;
    auditEvents: number;
    lastCeremony?: {
      id: string;
      issuerId: string;
      openedAt: Date;
      closedAt?: Date;
    };
    nextCeremonyDueAt?: Date;
    nextCeremonyIssuerId?: string;
  };
};

/** The common name of an RFC 4514 subject, or the subject. */
export const nameOf = (subject: string): string =>
  /(?:^|,)CN=((?:\\.|[^,])*)/.exec(subject)?.[1]?.replace(/\\(.)/g, "$1") ??
  subject;

const days = (ms: number) => Math.ceil(ms / DAY);

const inDays = (when: Date, now: Date) => {
  const left = days(when.getTime() - now.getTime());
  return left <= 0 ? "now" : left === 1 ? "in a day" : `in ${left} days`;
};

const SEVERITY_ORDER: Record<AttentionSeverityName, number> = {
  error: 0,
  warning: 1,
};

/**
 * The console's dashboard (ADR 0020, Monitoring; the "Operations" design):
 * the certificates counted, what expires within 90 days, what needs a
 * person, each CA's newest list, the last week, and the CA itself. Read
 * from the database alone; the signer's state is its own call.
 *
 * A certificate is replaced when it was renewed, or when its CA has issued
 * a later certificate for its subject: an ACME client's next order names
 * no certificate it renews.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async read(now = new Date()): Promise<DashboardRow> {
    const ago = (n: number) => new Date(now.getTime() - n * DAY);
    const ahead = (n: number) => new Date(now.getTime() + n * DAY);

    // The latest expiry among each CA's valid certificates for a subject:
    // a certificate expiring before it has been replaced.
    const latest = new Map(
      (
        await this.prisma.certificate.groupBy({
          by: ["issuerId", "subject"],
          where: { status: "valid", notAfter: { gt: ago(EXPIRED_DAYS) } },
          _max: { notAfter: true },
        })
      ).map((row) => [
        `${row.issuerId}\n${row.subject}`,
        row._max.notAfter?.getTime() ?? 0,
      ]),
    );
    const replaced = (row: {
      issuerId: string;
      subject: string;
      notAfter: Date;
      renewedBy: { id: string } | null;
    }) =>
      row.renewedBy !== null ||
      (latest.get(`${row.issuerId}\n${row.subject}`) ?? 0) >
        row.notAfter.getTime();

    const [valid, issuers, current, expired, revoked, revokedThisWeek] =
      await Promise.all([
        this.prisma.certificate.count({
          where: { status: "valid", notAfter: { gt: now } },
        }),
        this.prisma.certificate.groupBy({
          by: ["issuerId"],
          where: { status: "valid", notAfter: { gt: now } },
        }),
        this.prisma.certificate.findMany({
          where: { status: "valid", notAfter: { gt: ago(EXPIRED_DAYS) } },
          select: {
            id: true,
            issuerId: true,
            profileId: true,
            subject: true,
            serial: true,
            notBefore: true,
            notAfter: true,
            createdAt: true,
            renewsId: true,
            renewedBy: { select: { id: true } },
            deployTargets: { select: { id: true }, take: 1 },
            acmeOrder: { select: { id: true } },
            profileVersion: {
              select: { version: true, validityDays: true, renewAtDays: true },
            },
            enrollment: { select: { names: { select: { value: true } } } },
          },
          orderBy: [{ notAfter: "asc" }, { id: "asc" }],
        }),
        this.prisma.certificate.findMany({
          where: { status: "valid", notAfter: { gt: ago(30), lte: now } },
          select: {
            issuerId: true,
            subject: true,
            notAfter: true,
            renewedBy: { select: { id: true } },
          },
          orderBy: { notAfter: "desc" },
        }),
        this.prisma.certificate.count({
          where: { status: "revoked", notAfter: { gt: now } },
        }),
        this.prisma.revocation.count({
          where: { revokedAt: { gt: ago(7) } },
        }),
      ]);

    // Certificates issued as a renewal over mTLS: their holder renews them.
    const overMtls = await renewedOverMtls(
      this.prisma,
      current.map((row) => row.id),
    );
    // When each CA first issued for a subject: a later one is a renewal.
    const firstFor = new Map<string, number>();
    for (const row of current) {
      const key = `${row.issuerId}\n${row.subject}`;
      firstFor.set(
        key,
        Math.min(firstFor.get(key) ?? Infinity, row.createdAt.getTime()),
      );
    }
    const listed: CertificateRow[] = current
      .filter((row) => !replaced(row))
      .map((row) => {
        const version = row.profileVersion;
        const renewer = renewerOf(row, overMtls);
        const renewal: RenewalModeName =
          renewer === "person" ? "manual" : "automatic";
        const dueAt = renewalDueAt(row.notAfter, version);
        const health = healthOf(row.notAfter, dueAt, renewal, now);
        return {
          certificateId: row.id,
          name: nameOf(row.subject),
          names: row.enrollment?.names.map((n) => n.value) ?? [],
          issuerId: row.issuerId,
          profileId: row.profileId ?? undefined,
          profileVersion: version?.version,
          serial: row.serial,
          notBefore: row.notBefore,
          notAfter: row.notAfter,
          issuedAt: row.createdAt,
          renewed:
            row.renewsId !== null ||
            (firstFor.get(`${row.issuerId}\n${row.subject}`) ?? Infinity) <
              row.createdAt.getTime(),
          renewalDueAt: dueAt,
          renewal,
          renewer,
          health,
        };
      });
    const unreplaced = listed.filter((row) => row.health !== "expired");
    const expiring: ExpiringRow[] = unreplaced.filter(
      (row) => row.notAfter <= ahead(EXPIRING_DAYS),
    );
    const health = { healthy: 0, renewing: 0, needsPerson: 0, failing: 0 };
    const renewers: Record<RenewerName, number> = {
      acme: 0,
      "deploy-target": 0,
      mtls: 0,
      person: 0,
    };
    for (const row of unreplaced) {
      renewers[row.renewer] += 1;
      if (row.health === "healthy") health.healthy += 1;
      else if (row.health === "needs-person") health.needsPerson += 1;
      else if (row.health === "failing") health.failing += 1;
      else health.renewing += 1;
    }
    const due30 = expiring.filter((e) => e.notAfter <= ahead(30));
    const expiredNow = expired.filter((row) => !replaced(row));

    const [
      crls,
      attentionFromCas,
      week,
      ca,
      ocsp,
      recent,
      handled,
      counts,
      activity,
    ] = await Promise.all([
      this.crls(now),
      this.casNeedingAPerson(now),
      this.week(now),
      this.ca(now),
      this.ocsp(now),
      this.recent(),
      this.handled(now),
      this.counts(now),
      this.activity(now),
    ]);

    const attention = [
      ...this.certificatesNeedingAPerson(expiring, now),
      ...(await this.deployTargetsNeedingAPerson(now)),
      ...crls
        .filter(
          (crl) =>
            crl.number !== undefined &&
            !crl.publishedAt &&
            crl.waitingSince !== undefined &&
            now.getTime() - crl.waitingSince.getTime() > UNPUBLISHED_MS,
        )
        .map((crl): AttentionRow => ({
          kind: "crl-unpublished",
          severity: "error",
          subjectType: "issuer",
          subjectId: crl.issuerId,
          title: crl.name,
          detail: `Its newest list (number ${crl.number}) has not been published: the CA's lists show why; publication is retried.`,
        })),
      ...attentionFromCas,
    ].sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) ||
        a.title.localeCompare(b.title),
    );

    return {
      asOf: now,
      certificates: {
        valid,
        issuers: issuers.length,
        dueWithin30Days: due30.length,
        dueManual: due30.filter((e) => e.renewal === "manual").length,
        expiredRecently: expiredNow.length,
        expiredNames: expiredNow.slice(0, 3).map((row) => nameOf(row.subject)),
        revoked,
        revokedThisWeek,
      },
      counts,
      health,
      renewers,
      activity,
      certificateList: listed,
      attention,
      authorities: crls.map((crl) => ({
        issuerId: crl.issuerId,
        tier: crl.tier,
        offline: crl.offline,
        number: crl.number,
        nextUpdate: crl.nextUpdate,
        publishedAt: crl.publishedAt,
        ocspResponderUntil: crl.ocspResponderUntil,
        ocspInCeremony: crl.ocspInCeremony,
        ocspSoonestLapse: crl.ocspSoonestLapse,
        revoked: crl.revoked,
        valid: crl.valid,
        expired: crl.expired,
      })),
      week,
      ca,
      ocsp,
      recent,
      handled,
    };
  }

  /** The headline counts beyond the certificates'. */
  private async counts(now: Date): Promise<DashboardRow["counts"]> {
    const live = {
      status: { in: ["active" as const, "closed" as const] },
      discardedAt: null,
      certificate: { not: null },
    };
    const [cas, offlineCas, ssh, profiles] = await Promise.all([
      this.prisma.issuer.count({ where: live }),
      this.prisma.issuer.count({
        where: { ...live, tier: { not: "issuing" } },
      }),
      this.prisma.sshCertificate.groupBy({
        by: ["type"],
        where: { status: "valid", validBefore: { gt: now } },
        _count: { _all: true },
      }),
      this.prisma.profile.count({ where: { deactivatedAt: null } }),
    ]);
    const ofType = (type: string) =>
      ssh.find((row) => row.type === type)?._count._all ?? 0;
    return {
      cas,
      offlineCas,
      sshValid: ofType("user") + ofType("host"),
      sshUser: ofType("user"),
      sshHost: ofType("host"),
      profiles,
    };
  }

  /**
   * Each of the last 90 days (UTC): certificates issued, renewed (a renewal
   * of one, or a later one from its CA for a subject it had issued for) and
   * revoked.
   */
  private async activity(now: Date): Promise<DashboardRow["activity"]> {
    const since = new Date(now.getTime() - (ACTIVITY_DAYS - 1) * DAY);
    since.setUTCHours(0, 0, 0, 0);
    const [issued, first, revocations] = await Promise.all([
      this.prisma.certificate.findMany({
        where: { createdAt: { gte: since } },
        select: {
          issuerId: true,
          subject: true,
          renewsId: true,
          createdAt: true,
        },
      }),
      this.prisma.certificate.groupBy({
        by: ["issuerId", "subject"],
        _min: { createdAt: true },
      }),
      this.prisma.revocation.findMany({
        where: { revokedAt: { gte: since } },
        select: { revokedAt: true },
      }),
    ]);
    const firstIssued = new Map(
      first.map((row) => [
        `${row.issuerId}\n${row.subject}`,
        row._min.createdAt?.getTime() ?? 0,
      ]),
    );
    const days = new Map<
      string,
      { day: string; issued: number; renewed: number; revoked: number }
    >();
    for (let i = 0; i < ACTIVITY_DAYS; i += 1) {
      const day = new Date(since.getTime() + i * DAY)
        .toISOString()
        .slice(0, 10);
      days.set(day, { day, issued: 0, renewed: 0, revoked: 0 });
    }
    const dayOf = (date: Date) => days.get(date.toISOString().slice(0, 10));
    for (const row of issued) {
      const entry = dayOf(row.createdAt);
      if (!entry) continue;
      const renewal =
        row.renewsId !== null ||
        (firstIssued.get(`${row.issuerId}\n${row.subject}`) ?? Infinity) <
          row.createdAt.getTime();
      if (renewal) entry.renewed += 1;
      else entry.issued += 1;
    }
    for (const row of revocations) {
      const entry = dayOf(row.revokedAt);
      if (entry) entry.revoked += 1;
    }
    return [...days.values()];
  }

  /** CAs answering OCSP, online CAs with no responder, the soonest lapse. */
  private async ocsp(now: Date): Promise<DashboardRow["ocsp"]> {
    const inService = {
      status: "active" as const,
      notBefore: { lte: now },
      notAfter: { gt: now },
    };
    const [answering, missingOnline, soonest] = await Promise.all([
      this.prisma.issuer.count({
        where: {
          discardedAt: null,
          ocspResponders: { some: inService },
        },
      }),
      this.prisma.issuer.count({
        where: {
          tier: "issuing",
          status: "active",
          discardedAt: null,
          certificate: { not: null },
          ocspResponders: { none: inService },
        },
      }),
      this.prisma.ocspResponse.aggregate({ _min: { nextUpdate: true } }),
    ]);
    return {
      answering,
      missingOnline,
      soonestLapse: soonest._min.nextUpdate ?? undefined,
    };
  }

  /** The latest audit events, with what they concern by name. */
  private async recent(): Promise<DashboardRow["recent"]> {
    const events = await this.prisma.auditEvent.findMany({
      orderBy: { sequence: "desc" },
      take: RECENT_EVENTS,
    });
    const names = await subjectNamesOf(this.prisma, events);
    return events.map((event) => ({
      sequence: event.sequence,
      occurredAt: event.occurredAt,
      kind: event.kind,
      principal: event.principal,
      surface: event.surface,
      subjectType: event.subjectType ?? undefined,
      subjectId: event.subjectId ?? undefined,
      subjectName: names.get(`${event.subjectType}:${event.subjectId}`),
    }));
  }

  /** What ACME, renewal and the service did in the last 7 days. */
  private async handled(now: Date): Promise<DashboardRow["handled"]> {
    const rows = await this.prisma.auditEvent.groupBy({
      by: ["kind", "surface"],
      where: {
        occurredAt: { gt: new Date(now.getTime() - 7 * DAY) },
        surface: { in: ["acme", "renewal", "system"] },
      },
      _count: { _all: true },
      orderBy: [{ kind: "asc" }, { surface: "asc" }],
    });
    return rows.map((row) => ({
      kind: row.kind,
      surface: row.surface,
      count: row._count._all,
    }));
  }

  /**
   * Certificates past their renewal point: nothing renews a manual one, so
   * a person must; an automatic one should have been renewed by now.
   */
  private certificatesNeedingAPerson(
    expiring: ExpiringRow[],
    now: Date,
  ): AttentionRow[] {
    return expiring
      .filter((e) => e.renewalDueAt <= now)
      .map((e) => {
        const urgent =
          e.notAfter.getTime() - now.getTime() <= URGENT_DAYS * DAY;
        const manual = e.renewal === "manual";
        return {
          kind: manual ? "certificate-due" : "renewal-overdue",
          severity: urgent ? "error" : "warning",
          subjectType: "certificate",
          subjectId: e.certificateId,
          title: e.name,
          detail: manual
            ? `Expires ${inDays(e.notAfter, now)} and nothing renews it: renew it, or issue its successor, and install it.`
            : `Expires ${inDays(e.notAfter, now)}, past its renewal point, and has not been renewed: its renewal is failing.`,
          dueAt: e.notAfter,
        };
      });
  }

  /** Deployments failing, endpoints behind, must-staple without stapling. */
  private async deployTargetsNeedingAPerson(
    now: Date,
  ): Promise<AttentionRow[]> {
    const targets = await this.prisma.deployTarget.findMany({
      select: {
        id: true,
        name: true,
        endpoint: true,
        certificate: { select: { notAfter: true } },
        deployments: {
          where: { status: "pending" },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        observations: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
      orderBy: { name: "asc" },
    });
    const rows: AttentionRow[] = [];
    for (const target of targets) {
      const pending = target.deployments[0];
      if (
        pending &&
        now.getTime() - pending.createdAt.getTime() > DEPLOYMENT_FAILING_MS
      ) {
        rows.push({
          kind: "deployment-failing",
          severity: "error",
          subjectType: "deploy-target",
          subjectId: target.id,
          title: target.name,
          detail: `Its deployment has waited since ${pending.createdAt.toISOString()}${pending.lastError ? `: ${pending.lastError}` : ""}.`,
          dueAt: target.certificate.notAfter,
        });
      }
      const seen = target.observations[0];
      if (seen && seen.result !== "current") {
        rows.push({
          kind: "endpoint-stale",
          severity: "warning",
          subjectType: "deploy-target",
          subjectId: target.id,
          title: target.name,
          detail: {
            previous: `${target.endpoint} still serves the certificate before: nginx has not reloaded.`,
            other: `${target.endpoint} serves a certificate it never deployed: its configuration names other files.`,
            unreachable: `${target.endpoint} did not answer: ${seen.error ?? "no handshake"}.`,
          }[seen.result],
          dueAt: seen.servedNotAfter ?? undefined,
        });
      }
      if (seen?.servedMustStaple && seen.stapled === false) {
        rows.push({
          kind: "endpoint-not-stapling",
          severity: "error",
          subjectType: "deploy-target",
          subjectId: target.id,
          title: target.name,
          detail: `${target.endpoint} serves a must-staple certificate without stapling: clients that honour must-staple refuse it.`,
        });
      }
    }
    return rows;
  }

  /**
   * Each active CA's newest list, published or waiting, online CAs first;
   * `waitingSince` is for the attention items only.
   */
  private async crls(
    now: Date,
  ): Promise<(CrlRow & { name: string; waitingSince?: Date })[]> {
    const issuers = await this.prisma.issuer.findMany({
      where: {
        status: { in: ["active", "closed"] },
        discardedAt: null,
        certificate: { not: null },
      },
      select: {
        id: true,
        tier: true,
        subject: true,
        crls: {
          orderBy: { number: "desc" },
          take: 1,
          select: { number: true, createdAt: true, publishedAt: true },
        },
        ocspResponders: {
          where: {
            status: "active",
            notBefore: { lte: now },
            notAfter: { gt: now },
          },
          orderBy: { notAfter: "desc" },
          take: 1,
          select: { notAfter: true, ceremonyId: true },
        },
      },
      orderBy: { id: "asc" },
    });
    const countOf = (where: Prisma.CertificateWhereInput) =>
      this.prisma.certificate.groupBy({
        by: ["issuerId"],
        where,
        _count: { _all: true },
      });
    const [soonest, revoked, valid, expired] = await Promise.all([
      this.prisma.ocspResponse.groupBy({
        by: ["issuerId"],
        _min: { nextUpdate: true },
      }),
      countOf({ status: "revoked", notAfter: { gt: now } }),
      countOf({ status: "valid", notAfter: { gt: now } }),
      countOf({ status: "valid", notAfter: { lte: now } }),
    ]);
    const counted = (
      rows: { issuerId: string; _count: { _all: number } }[],
      issuerId: string,
    ) => rows.find((row) => row.issuerId === issuerId)?._count._all ?? 0;
    const published = await Promise.all(
      issuers.map((issuer) =>
        this.prisma.crl.findFirst({
          where: { issuerId: issuer.id, publishedAt: { not: null } },
          orderBy: { number: "desc" },
          select: { nextUpdate: true, publishedAt: true },
        }),
      ),
    );
    return issuers
      .map((issuer, i) => {
        const newest = issuer.crls[0];
        return {
          issuerId: issuer.id,
          name: nameOf(issuer.subject),
          tier: issuer.tier,
          offline: issuer.tier !== "issuing",
          number: newest?.number,
          nextUpdate: published[i]?.nextUpdate,
          publishedAt: newest?.publishedAt ?? undefined,
          waitingSince:
            newest && !newest.publishedAt ? newest.createdAt : undefined,
          ocspResponderUntil: issuer.ocspResponders[0]?.notAfter,
          ocspInCeremony: issuer.ocspResponders[0]
            ? issuer.ocspResponders[0].ceremonyId !== null
            : undefined,
          ocspSoonestLapse:
            soonest.find((row) => row.issuerId === issuer.id)?._min
              .nextUpdate ?? undefined,
          revoked: counted(revoked, issuer.id),
          valid: counted(valid, issuer.id),
          expired: counted(expired, issuer.id),
        };
      })
      .sort((a, b) => Number(a.offline) - Number(b.offline));
  }

  /** Offline CAs due a ceremony, issuing windows closing, unproved backups. */
  private async casNeedingAPerson(now: Date): Promise<AttentionRow[]> {
    const issuers = await this.prisma.issuer.findMany({
      where: {
        status: "active",
        discardedAt: null,
        certificate: { not: null },
      },
      select: {
        id: true,
        tier: true,
        subject: true,
        notAfter: true,
        maxValidityDays: true,
        provedAt: true,
        crls: {
          where: { publishedAt: { not: null } },
          orderBy: { number: "desc" },
          take: 1,
          select: { nextUpdate: true },
        },
        ocspResponders: {
          where: { status: "active" },
          orderBy: { notAfter: "desc" },
          take: 1,
          select: { notAfter: true },
        },
      },
      orderBy: { id: "asc" },
    });
    const ceremonyBy = new Date(now.getTime() + CEREMONY_DAYS * DAY);
    const urgent = (when: Date): AttentionSeverityName =>
      when.getTime() - now.getTime() <= URGENT_DAYS * DAY ? "error" : "warning";
    const rows: AttentionRow[] = [];
    for (const issuer of issuers) {
      const offline = issuer.tier !== "issuing";
      const title = nameOf(issuer.subject);
      const list = issuer.crls[0]?.nextUpdate;
      if (offline && list && list <= ceremonyBy) {
        rows.push({
          kind: "offline-crl-due",
          severity: urgent(list),
          subjectType: "issuer",
          subjectId: issuer.id,
          title,
          detail: `Its list lapses ${inDays(list, now)}: sign the next in a ceremony, with the offline media and the passphrase.`,
          dueAt: list,
        });
      }
      const responder = issuer.ocspResponders[0]?.notAfter;
      if (offline && responder && responder <= ceremonyBy) {
        rows.push({
          kind: "offline-ocsp-due",
          severity: urgent(responder),
          subjectType: "issuer",
          subjectId: issuer.id,
          title,
          detail: `Its OCSP responder lapses ${inDays(responder, now)}: issue the next in a ceremony.`,
          dueAt: responder,
        });
      }
      if (offline && !issuer.provedAt) {
        rows.push({
          kind: "backup-unproved",
          severity: "warning",
          subjectType: "issuer",
          subjectId: issuer.id,
          title,
          detail:
            "Its key's backup has not been proved: open a ceremony with the key file from the offline media.",
        });
      }
      if (issuer.notAfter) {
        const closes = issuingWindowClosesAt(
          issuer.notAfter,
          issuer.maxValidityDays,
        );
        if (closes.getTime() - now.getTime() < 365 * DAY) {
          rows.push({
            kind: "issuing-window",
            severity: urgent(closes),
            subjectType: "issuer",
            subjectId: issuer.id,
            title,
            detail: `It stops issuing ${inDays(closes, now)}: create its successor, the next generation, in a ceremony.`,
            dueAt: closes,
          });
        }
      }
    }
    return rows;
  }

  private async week(now: Date): Promise<DashboardRow["week"]> {
    const since = new Date(now.getTime() - 7 * DAY);
    const [issued, renewals, acmeOrders, acmeOrdersFailed, deployed, failing] =
      await Promise.all([
        this.prisma.certificate.count({ where: { createdAt: { gt: since } } }),
        this.prisma.certificate.count({
          where: { createdAt: { gt: since }, renewsId: { not: null } },
        }),
        this.prisma.acmeOrder.count({ where: { createdAt: { gt: since } } }),
        this.prisma.acmeOrder.count({
          where: { createdAt: { gt: since }, status: "invalid" },
        }),
        this.prisma.deployment.count({ where: { deployedAt: { gt: since } } }),
        this.prisma.deployment.count({
          where: {
            status: "pending",
            createdAt: {
              lt: new Date(now.getTime() - DEPLOYMENT_FAILING_MS),
            },
          },
        }),
      ]);
    return {
      issued,
      renewals,
      acmeOrders,
      acmeOrdersFailed,
      deployed,
      deploymentsFailing: failing,
    };
  }

  private async ca(now: Date): Promise<DashboardRow["ca"]> {
    const [lastPublished, auditEvents, lastCeremony, offline] =
      await Promise.all([
        this.prisma.crl.findFirst({
          where: { publishedAt: { not: null } },
          orderBy: { publishedAt: "desc" },
          select: { publishedAt: true },
        }),
        this.prisma.auditEvent.count(),
        this.prisma.ceremony.findFirst({ orderBy: { openedAt: "desc" } }),
        this.prisma.issuer.findMany({
          where: {
            status: "active",
            discardedAt: null,
            tier: { not: "issuing" },
            certificate: { not: null },
          },
          select: {
            id: true,
            crls: {
              where: { publishedAt: { not: null } },
              orderBy: { number: "desc" },
              take: 1,
              select: { nextUpdate: true },
            },
            ocspResponders: {
              where: { status: "active" },
              orderBy: { notAfter: "desc" },
              take: 1,
              select: { notAfter: true },
            },
          },
        }),
      ]);
    // The soonest an offline CA's list or responder lapses.
    let next: { at: Date; issuerId: string } | undefined;
    for (const issuer of offline) {
      for (const at of [
        issuer.crls[0]?.nextUpdate,
        issuer.ocspResponders[0]?.notAfter,
      ]) {
        if (at && at > now && (!next || at < next.at)) {
          next = { at, issuerId: issuer.id };
        }
      }
    }
    return {
      lastPublishedAt: lastPublished?.publishedAt ?? undefined,
      auditEvents,
      lastCeremony: lastCeremony
        ? {
            id: lastCeremony.id,
            issuerId: lastCeremony.issuerId,
            openedAt: lastCeremony.openedAt,
            closedAt: lastCeremony.closedAt ?? undefined,
          }
        : undefined,
      nextCeremonyDueAt: next?.at,
      nextCeremonyIssuerId: next?.issuerId,
    };
  }
}
