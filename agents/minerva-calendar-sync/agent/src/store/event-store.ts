import {
  CanonicalCalendarEvent,
  EventFilter,
  SyncState,
} from "../domain/canonical-event";

/**
 * What upsertEvent actually did — lets SyncEngine tally accurate
 * added/updated counts for sync history instead of treating every upsert
 * of a pre-existing row as a "change", which a full resync would otherwise
 * report for every untouched event on the calendar.
 */
export type UpsertResult = "created" | "updated" | "unchanged";

/**
 * Persistence seam. SyncEngine and the read API depend only on this
 * interface, never on a concrete backend (Prisma/SQL today, a custom API
 * later), so swapping the backend never touches their code.
 */
export interface EventStore {
  /** Diffs against any existing row with the same source+uid — only writes, and only reports "updated", when a field actually differs. */
  upsertEvent(event: CanonicalCalendarEvent): Promise<UpsertResult>;
  /** Returns whether it actually flipped `cancelled` (false if already cancelled, or no matching row). */
  markCancelled(source: string, uid: string): Promise<boolean>;
  /** Soft-delete: sets `deleted = true`, never removes the row. Returns whether it actually flipped `deleted`. */
  markDeleted(source: string, uid: string): Promise<boolean>;
  getEvent(source: string, uid: string): Promise<CanonicalCalendarEvent | null>;
  listEvents(filter: EventFilter): Promise<CanonicalCalendarEvent[]>;
  /** Non-cancelled, non-deleted events overlapping [start, end) — the shape availability computation needs, distinct from listEvents' startTime-only filtering. */
  listEventsOverlapping(
    start: string,
    end: string,
  ): Promise<CanonicalCalendarEvent[]>;
  getSyncState(calendarId: string): Promise<SyncState | null>;
  saveSyncState(calendarId: string, state: SyncState): Promise<void>;
}

/** Nest DI token — inject with `@Inject(EVENT_STORE)`. */
export const EVENT_STORE = Symbol("EVENT_STORE");
