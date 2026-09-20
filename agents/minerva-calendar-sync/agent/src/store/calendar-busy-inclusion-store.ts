/**
 * Whether a calendar's events count toward the busy/free calculation, keyed
 * by calendarId. A calendar with no stored row is included — the default —
 * so e.g. a shared holidays calendar can be synced (and stay visible in the
 * events list) without affecting computed availability until switched off.
 */
export interface CalendarBusyInclusionStore {
  /** Only calendars with an explicit stored value — callers default anything missing to included. */
  listOverrides(): Promise<Record<string, boolean>>;
  setIncludedInBusy(calendarId: string, includedInBusy: boolean): Promise<void>;
}

/** Nest DI token — inject with `@Inject(CALENDAR_BUSY_INCLUSION_STORE)`. */
export const CALENDAR_BUSY_INCLUSION_STORE = Symbol("CALENDAR_BUSY_INCLUSION_STORE");
