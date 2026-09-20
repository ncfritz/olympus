import { Injectable } from "@nestjs/common";
import { OutboxEvent as OutboxRow } from "@prisma/client";
import { CanonicalCalendarEvent } from "../../domain/canonicalEvent";
import {
  OutboxAction,
  OutboxRecord,
  OutboxSourceStats,
  OutboxStatus,
} from "../../domain/outbox";
import { OutboxStore } from "../outboxStore";
import { PrismaService } from "./PrismaService";

@Injectable()
export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<OutboxSourceStats[]> {
    const [counts, oldestPending] = await Promise.all([
      this.prisma.outboxEvent.groupBy({
        by: ["source", "status"],
        _count: { _all: true },
      }),
      this.prisma.outboxEvent.groupBy({
        by: ["source"],
        where: { status: "pending" },
        _min: { createdAt: true },
      }),
    ]);

    const oldestBySource = new Map(
      oldestPending.map((row) => [row.source, row._min.createdAt]),
    );
    const bySource = new Map<string, OutboxSourceStats>();

    for (const row of counts) {
      const stats = bySource.get(row.source) ?? {
        source: row.source,
        pending: 0,
        sent: 0,
        failed: 0,
        oldestPendingAt: null,
      };
      stats[row.status as OutboxStatus] = row._count._all;
      bySource.set(row.source, stats);
    }

    for (const stats of bySource.values()) {
      stats.oldestPendingAt =
        oldestBySource.get(stats.source)?.toISOString() ?? null;
    }

    return [...bySource.values()].sort((a, b) =>
      a.source.localeCompare(b.source),
    );
  }

  async listFailed(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(fromRow);
  }

  async getLatestForEvent(eventId: string): Promise<OutboxRecord | null> {
    const row = await this.prisma.outboxEvent.findFirst({
      where: { eventId },
      orderBy: { createdAt: "desc" },
    });
    return row ? fromRow(row) : null;
  }

  async requeue(id: string): Promise<boolean> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: { id, status: "failed" },
      data: {
        status: "pending",
        attempts: 0,
        lastError: null,
        availableAt: new Date(),
      },
    });
    return result.count > 0;
  }

  async enqueueBackfill(
    source: string,
    events: CanonicalCalendarEvent[],
  ): Promise<number> {
    if (events.length === 0) return 0;

    const result = await this.prisma.outboxEvent.createMany({
      data: events.map((event) => ({
        eventId: event.id,
        source,
        action: "backfill",
        payload: JSON.stringify(event),
      })),
    });
    return result.count;
  }
}

function fromRow(row: OutboxRow): OutboxRecord {
  let subject = row.eventId;
  try {
    subject = JSON.parse(row.payload).subject ?? subject;
  } catch {
    // Payload is our own JSON.stringify output — this can only happen if a
    // row somehow predates a payload-shape change. Falling back to the
    // event id keeps the admin view usable rather than throwing.
  }

  return {
    id: row.id,
    eventId: row.eventId,
    source: row.source,
    subject,
    action: row.action as OutboxAction,
    status: row.status as OutboxStatus,
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
  };
}
