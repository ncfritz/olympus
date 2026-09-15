import { Injectable } from "@nestjs/common";
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
} from "../../domain/canonical-event";
import { EventStore } from "../event-store";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaEventStore implements EventStore {
  constructor(private readonly prisma: PrismaService) {}

  async upsertEvent(event: CanonicalCalendarEvent): Promise<void> {
    const data = toRow(event);
    await this.prisma.event.upsert({
      where: { source_uid: { source: event.source, uid: event.uid } },
      create: data,
      update: data,
    });
  }

  async markCancelled(source: string, uid: string): Promise<void> {
    // updateMany rather than update: callers may resolve `uid` heuristically
    // (see resolveGoogleRemoval) and a miss should be a harmless no-op, not a
    // thrown "record not found".
    await this.prisma.event.updateMany({
      where: { source, uid },
      data: { cancelled: true },
    });
  }

  async markDeleted(source: string, uid: string): Promise<void> {
    await this.prisma.event.updateMany({
      where: { source, uid },
      data: { deleted: true },
    });
  }

  async getEvent(source: string, uid: string): Promise<CanonicalCalendarEvent | null> {
    const row = await this.prisma.event.findUnique({ where: { source_uid: { source, uid } } });
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

  async getSyncState(calendarId: string): Promise<SyncState | null> {
    const row = await this.prisma.syncState.findUnique({ where: { calendarId } });
    if (!row) return null;

    return {
      calendarId: row.calendarId,
      syncToken: row.syncToken,
      channelId: row.channelId,
      resourceId: row.resourceId,
      channelExpiration: row.channelExpiration?.toISOString() ?? null,
      channelToken: row.channelToken,
    };
  }

  async saveSyncState(calendarId: string, state: SyncState): Promise<void> {
    const data = {
      syncToken: state.syncToken,
      channelId: state.channelId,
      resourceId: state.resourceId,
      channelExpiration: state.channelExpiration ? new Date(state.channelExpiration) : null,
      channelToken: state.channelToken,
    };

    await this.prisma.syncState.upsert({
      where: { calendarId },
      create: { calendarId, ...data },
      update: data,
    });
  }
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
  };
}
