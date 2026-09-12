import { CanonicalCalendarEvent, EventFilter, SyncState } from "../domain/canonical-event";

/**
 * Persistence seam. SyncEngine and the read API depend only on this
 * interface, never on a concrete backend (Prisma/SQL today, a custom API
 * later), so swapping the backend never touches their code.
 */
export interface EventStore {
  upsertEvent(event: CanonicalCalendarEvent): Promise<void>;
  markCancelled(source: string, uid: string): Promise<void>;
  /** Soft-delete: sets `deleted = true`, never removes the row. */
  markDeleted(source: string, uid: string): Promise<void>;
  getEvent(source: string, uid: string): Promise<CanonicalCalendarEvent | null>;
  listEvents(filter: EventFilter): Promise<CanonicalCalendarEvent[]>;
  getSyncState(calendarId: string): Promise<SyncState | null>;
  saveSyncState(calendarId: string, state: SyncState): Promise<void>;
}

/** Nest DI token — inject with `@Inject(EVENT_STORE)`. */
export const EVENT_STORE = Symbol("EVENT_STORE");
