/**
 * Whether a configured calendar's sync is paused, keyed by calendarId. A
 * calendar with no stored row is enabled — the default — so a newly
 * configured calendar works without anyone having to flip it on first.
 */
export interface CalendarEnablementStore {
  /** Only calendars with an explicit stored value — callers default anything missing to enabled. */
  listOverrides(): Promise<Record<string, boolean>>;
  setEnabled(calendarId: string, enabled: boolean): Promise<void>;
}

/** Nest DI token — inject with `@Inject(CALENDAR_ENABLEMENT_STORE)`. */
export const CALENDAR_ENABLEMENT_STORE = Symbol("CALENDAR_ENABLEMENT_STORE");
