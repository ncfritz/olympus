/** One calendar this instance keeps synchronized. Config-driven: adding a calendar is a config change, not a code change. */
export interface SyncedCalendarConfig {
  /** Which CalendarProvider implementation to use. */
  provider: "google";
  /** Which stored OAuth credential to authorize with (see google-credential-store). */
  accountLabel: string;
  /** The provider's own calendar id (e.g. "primary" or a shared calendar's id). */
  calendarId: string;
  /** The `source` label written onto every CanonicalCalendarEvent row for this calendar. */
  source: string;
}
