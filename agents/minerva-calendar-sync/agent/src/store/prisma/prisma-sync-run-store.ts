import { Injectable } from "@nestjs/common";
import { Prisma, SyncRun as SyncRunRow, SyncRunEventChange as SyncRunEventChangeRow } from "@prisma/client";
import {
  NewSyncRun,
  SyncRun,
  SyncRunDailyStat,
  SyncRunEventAction,
  SyncRunEventChange,
  SyncRunFilter,
  SyncRunStatsFilter,
  SyncRunStatus,
  SyncRunTrigger,
  SyncRunType,
  SyncRunWithChanges,
} from "../../domain/sync-run";
import { SyncRunStore } from "../sync-run-store";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaSyncRunStore implements SyncRunStore {
  constructor(private readonly prisma: PrismaService) {}

  async create(run: NewSyncRun): Promise<SyncRun> {
    const row = await this.prisma.syncRun.create({
      data: {
        calendarId: run.calendarId,
        source: run.source,
        type: run.type,
        trigger: run.trigger,
        status: run.status,
        startedAt: new Date(run.startedAt),
        finishedAt: new Date(run.finishedAt),
        totalCount: run.totalCount,
        addedCount: run.addedCount,
        updatedCount: run.updatedCount,
        deletedCount: run.deletedCount,
        errorMessage: run.errorMessage,
        changes: {
          create: run.changes.map((change) => ({
            action: change.action,
            eventId: change.eventId,
            subject: change.subject,
            startTime: change.startTime ? new Date(change.startTime) : null,
          })),
        },
      },
    });
    return fromRow(row);
  }

  async list(filter: SyncRunFilter): Promise<SyncRun[]> {
    const where: Prisma.SyncRunWhereInput = {
      calendarId: filter.calendarId,
      type: filter.type,
      trigger: filter.trigger,
      status: filter.status,
    };
    const rows = await this.prisma.syncRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: filter.limit ?? 50,
      ...(filter.cursor ? { skip: 1, cursor: { id: filter.cursor } } : {}),
    });
    return rows.map(fromRow);
  }

  /**
   * Pulls every matching row into Node and aggregates there, rather than a
   * dialect-specific date-truncated raw SQL GROUP BY (SQLite's `strftime`
   * vs. Postgres's `date_trunc` would diverge this store between the two
   * backends). Fine at personal/small-team scale — a handful of calendars
   * polled every ~45s over a 30-day window is at most a few hundred
   * thousand small rows, well within what Node can group in memory.
   */
  async dailyStats(filter: SyncRunStatsFilter): Promise<SyncRunDailyStat[]> {
    const rows = await this.prisma.syncRun.findMany({
      where: {
        calendarId: filter.calendarId,
        type: filter.type,
        trigger: filter.trigger,
        status: filter.status,
        startedAt: { gte: new Date(filter.since) },
      },
      select: {
        calendarId: true,
        source: true,
        startedAt: true,
        finishedAt: true,
        status: true,
        totalCount: true,
        addedCount: true,
        updatedCount: true,
        deletedCount: true,
      },
    });

    const buckets = new Map<string, MutableDailyStat>();
    for (const row of rows) {
      const date = row.startedAt.toISOString().slice(0, 10);
      const key = `${date}|${row.calendarId}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          date,
          calendarId: row.calendarId,
          source: row.source,
          runCount: 0,
          successCount: 0,
          errorCount: 0,
          durationMsSum: 0,
          totalCount: 0,
          addedCount: 0,
          updatedCount: 0,
          deletedCount: 0,
        };
        buckets.set(key, bucket);
      }

      bucket.runCount += 1;
      if (row.status === "success") bucket.successCount += 1;
      else bucket.errorCount += 1;
      bucket.durationMsSum += row.finishedAt.getTime() - row.startedAt.getTime();
      bucket.totalCount += row.totalCount;
      bucket.addedCount += row.addedCount;
      bucket.updatedCount += row.updatedCount;
      bucket.deletedCount += row.deletedCount;
    }

    return [...buckets.values()]
      .map(({ durationMsSum, ...bucket }) => ({
        ...bucket,
        avgDurationMs: bucket.runCount > 0 ? Math.round(durationMsSum / bucket.runCount) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.calendarId.localeCompare(b.calendarId));
  }

  async get(id: string): Promise<SyncRunWithChanges | null> {
    const row = await this.prisma.syncRun.findUnique({
      where: { id },
      include: { changes: { orderBy: { id: "asc" } } },
    });
    if (!row) return null;
    return { ...fromRow(row), changes: row.changes.map(changeFromRow) };
  }

  async pruneFinishedBefore(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.syncRun.deleteMany({ where: { finishedAt: { lt: cutoff } } });
    return count;
  }
}

/** Accumulator for dailyStats — `durationMsSum` is divided down to `avgDurationMs` and dropped once a bucket is finalized. */
interface MutableDailyStat extends Omit<SyncRunDailyStat, "avgDurationMs"> {
  durationMsSum: number;
}

function fromRow(row: SyncRunRow): SyncRun {
  return {
    id: row.id,
    calendarId: row.calendarId,
    source: row.source,
    type: row.type as SyncRunType,
    trigger: row.trigger as SyncRunTrigger,
    status: row.status as SyncRunStatus,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt.toISOString(),
    totalCount: row.totalCount,
    addedCount: row.addedCount,
    updatedCount: row.updatedCount,
    deletedCount: row.deletedCount,
    errorMessage: row.errorMessage,
  };
}

function changeFromRow(row: SyncRunEventChangeRow): SyncRunEventChange {
  return {
    action: row.action as SyncRunEventAction,
    eventId: row.eventId,
    subject: row.subject,
    startTime: row.startTime?.toISOString() ?? null,
  };
}
