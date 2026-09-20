import { SyncedCalendarConfig } from "../sync/syncedCalendarConfig";

/**
 * The durable, DB-backed list of calendars this instance keeps synchronized
 * — every calendar goes through here, added at runtime through the Sync
 * page's discovery UI (see SyncConfigService).
 */
export interface SyncedCalendarStore {
  listAll(): Promise<SyncedCalendarConfig[]>;
  add(calendar: SyncedCalendarConfig): Promise<void>;
  remove(calendarId: string): Promise<void>;
}

/** Nest DI token — inject with `@Inject(SYNCED_CALENDAR_STORE)`. */
export const SYNCED_CALENDAR_STORE = Symbol("SYNCED_CALENDAR_STORE");
