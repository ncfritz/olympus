import { Inject, Injectable } from "@nestjs/common";
import { Event as EventRow, Prisma } from "@prisma/client";
import {
  CanonicalCalendarEvent,
  EventFilter,
  EventType,
  FreeBusyStatus,
  Importance,
  OccurrenceType,
  ResponseStatus,
  Sensitivity,
  SyncState,
} from "../../domain/canonicalEvent";
import { EventStore, UpsertResult } from "../eventStore";
import { OUTBOX_ENABLED } from "../outboxStore";
import { PrismaService } from "./PrismaService";

@Injectable()
export class PrismaEventStore implements EventStore {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OUTBOX_ENABLED) private readonly outboxEnabled: boolean = false,
  ) {}

  async upsertEvent(event: CanonicalCalendarEvent): Promise<UpsertResult> {
    const data = toRow(event);
    const existing = await this.prisma.event.findUnique({
      where: { source_uid: { source: event.source, uid: event.uid } },
    });

    if (existing && rowsEqual(existing, data)) {
      return "unchanged";
    }

    const result: UpsertResult = existing ? "updated" : "created";
    await this.prisma.$transaction(
      this.withOutbox(
        event,
        existing
          ? this.prisma.event.update({
              where: { source_uid: { source: event.source, uid: event.uid } },
              data,
            })
          : this.prisma.event.create({ data }),
      ),
    );
    return result;
  }

  async markCancelled(source: string, uid: string): Promise<boolean> {
    // updateMany rather than update: callers may resolve `uid` heuristically
    // (see resolveGoogleRemoval) and a miss should be a harmless no-op, not a
    // thrown "record not found". Excluding already-cancelled rows from the
    // where clause is what lets the caller tell a real flip from a no-op.
    return this.flipAndEnqueue(source, uid, "cancelled");
  }

  async markDeleted(source: string, uid: string): Promise<boolean> {
    return this.flipAndEnqueue(source, uid, "deleted");
  }

  /**
   * Shared by markCancelled/markDeleted: flips `field` from false to true,
   * and — only when it actually changed a row — enqueues the resulting full
   * row to the outbox in the same transaction, matching upsertEvent's
   * guarantee that an outbox row is written exactly when, and atomically
   * with, an Event row actually changes.
   */
  private async flipAndEnqueue(
    source: string,
    uid: string,
    field: "cancelled" | "deleted",
  ): Promise<boolean> {
    const existing = await this.prisma.event.findUnique({
      where: { source_uid: { source, uid } },
    });
    if (!existing || existing[field]) return false;

    const updated: EventRow = { ...existing, [field]: true };
    await this.prisma.$transaction(
      this.withOutbox(
        fromRow(updated),
        this.prisma.event.updateMany({
          where: { source, uid, [field]: false },
          data: { [field]: true },
        }),
      ),
    );
    return true;
  }

  /**
   * Bundles `write` with an outbox row queuing a full snapshot of `event`
   * for OutboxDispatcherService, so both land in the same `$transaction` —
   * unless outbound sync isn't configured (OUTBOX_ENABLED false), in which
   * case no outbox row is written at all rather than accumulating forever
   * unconsumed.
   */
  private withOutbox(
    event: CanonicalCalendarEvent,
    write: Prisma.PrismaPromise<unknown>,
  ): Prisma.PrismaPromise<unknown>[] {
    if (!this.outboxEnabled) return [write];

    const enqueue = this.prisma.outboxEvent.create({
      data: {
        eventId: event.id,
        source: event.source,
        action: event.deleted ? "delete" : "upsert",
        payload: JSON.stringify(event),
      },
    });
    return [write, enqueue];
  }

  async getEvent(
    source: string,
    uid: string,
  ): Promise<CanonicalCalendarEvent | null> {
    const row = await this.prisma.event.findUnique({
      where: { source_uid: { source, uid } },
    });
    return row ? fromRow(row) : null;
  }

  async getEventById(id: string): Promise<CanonicalCalendarEvent | null> {
    const row = await this.prisma.event.findUnique({ where: { id } });
    return row ? fromRow(row) : null;
  }

  async listEvents(filter: EventFilter): Promise<CanonicalCalendarEvent[]> {
    const where: Prisma.EventWhereInput = {
      source: filter.source,
      cancelled: filter.cancelled,
      deleted: filter.deleted,
      occurrenceType: filter.occurrenceType,
      startTime: {
        gte: filter.startsAfter ? new Date(filter.startsAfter) : undefined,
        lte: filter.startsBefore ? new Date(filter.startsBefore) : undefined,
      },
    };

    const rows = await this.prisma.event.findMany({
      where,
      // Most recent/upcoming first: with years of history on a real
      // calendar, an ascending default combined with `limit` would silently
      // bury anything recent under old events instead of ever reaching them.
      orderBy: { startTime: "desc" },
      take: filter.limit ?? 100,
      ...(filter.cursor ? { skip: 1, cursor: { id: filter.cursor } } : {}),
    });

    return rows.map(fromRow);
  }

  async listEventsOverlapping(
    start: string,
    end: string,
  ): Promise<CanonicalCalendarEvent[]> {
    const rows = await this.prisma.event.findMany({
      where: {
        cancelled: false,
        deleted: false,
        startTime: { lt: new Date(end) },
        endTime: { gt: new Date(start) },
      },
    });
    return rows.map(fromRow);
  }

  async getSyncState(calendarId: string): Promise<SyncState | null> {
    const row = await this.prisma.syncState.findUnique({
      where: { calendarId },
    });
    if (!row) return null;

    return {
      calendarId: row.calendarId,
      syncToken: row.syncToken,
      channelId: row.channelId,
      resourceId: row.resourceId,
      channelExpiration: row.channelExpiration?.toISOString() ?? null,
      channelToken: row.channelToken,
      lastFullSyncAt: row.lastFullSyncAt?.toISOString() ?? null,
      lastSyncedAt: row.updatedAt.toISOString(),
    };
  }

  async saveSyncState(calendarId: string, state: SyncState): Promise<void> {
    const data = {
      syncToken: state.syncToken,
      channelId: state.channelId,
      resourceId: state.resourceId,
      channelExpiration: state.channelExpiration
        ? new Date(state.channelExpiration)
        : null,
      channelToken: state.channelToken,
      lastFullSyncAt: state.lastFullSyncAt
        ? new Date(state.lastFullSyncAt)
        : null,
    };

    await this.prisma.syncState.upsert({
      where: { calendarId },
      create: { calendarId, ...data },
      update: data,
    });
  }
}

/** Field-by-field comparison used to tell a real change from an untouched event a full resync re-fetched anyway. */
function rowsEqual(
  existing: EventRow,
  next: ReturnType<typeof toRow>,
): boolean {
  return (
    existing.subject === next.subject &&
    existing.sensitivity === next.sensitivity &&
    existing.importance === next.importance &&
    existing.occurrenceType === next.occurrenceType &&
    existing.type === next.type &&
    existing.reminder === next.reminder &&
    existing.response === next.response &&
    existing.startTime.getTime() === next.startTime.getTime() &&
    existing.endTime.getTime() === next.endTime.getTime() &&
    existing.duration === next.duration &&
    existing.allDay === next.allDay &&
    existing.status === next.status &&
    existing.location === next.location &&
    existing.cancelled === next.cancelled &&
    existing.organizerEmail === next.organizerEmail &&
    existing.deleted === next.deleted &&
    existing.recurrenceId === next.recurrenceId &&
    existing.recurrenceRule === next.recurrenceRule
  );
}

function toRow(event: CanonicalCalendarEvent) {
  return {
    id: event.id,
    source: event.source,
    uid: event.uid,
    subject: event.subject,
    sensitivity: event.sensitivity,
    importance: event.importance,
    occurrenceType: event.occurrenceType,
    type: event.type,
    reminder: event.reminder,
    response: event.response,
    startTime: new Date(event.startTime),
    endTime: new Date(event.endTime),
    duration: event.duration,
    allDay: event.allDay,
    status: event.status,
    location: event.location,
    cancelled: event.cancelled,
    organizerEmail: event.organizerEmail,
    deleted: event.deleted,
    recurrenceId: event.recurrenceId,
    recurrenceRule: event.recurrenceRule,
  };
}

function fromRow(row: EventRow): CanonicalCalendarEvent {
  return {
    id: row.id,
    source: row.source,
    uid: row.uid,
    subject: row.subject,
    sensitivity: row.sensitivity as Sensitivity,
    importance: row.importance as Importance,
    occurrenceType: row.occurrenceType as OccurrenceType,
    type: row.type as EventType,
    reminder: row.reminder,
    response: row.response as ResponseStatus,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    duration: row.duration,
    allDay: row.allDay,
    status: row.status as FreeBusyStatus,
    location: row.location,
    cancelled: row.cancelled,
    organizerEmail: row.organizerEmail,
    deleted: row.deleted,
    recurrenceId: row.recurrenceId,
    recurrenceRule: row.recurrenceRule,
  };
}
