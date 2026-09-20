/** One calendar this instance keeps synchronized. Config-driven: adding a calendar is a config change, not a code change. */
export interface SyncedCalendarConfig {
  /** Which CalendarProvider implementation to use. */
  provider: "google" | "microsoft";
  /** Which stored OAuth credential to authorize with (see google-credential-store / microsoft-credential-store). */
  accountLabel: string;
  /** The provider's own calendar id (e.g. "primary" or a shared calendar's id). */
  calendarId: string;
  /** The `source` label written onto every CanonicalCalendarEvent row for this calendar. */
  source: string;
  /**
   * Opt into push notifications for this calendar, in addition to polling
   * (which always stays on as the safety net — push delivery is never
   * fully guaranteed). Requires WEBHOOK_BASE_URL to be a real HTTPS
   * endpoint the provider can reach; ignored otherwise.
   *
   * Required (not optional) here because this is the normalized, in-app
   * shape — SyncConfigService's parser is what makes the field optional in
   * SYNCED_CALENDARS itself, defaulting it to false.
   */
  enablePush: boolean;
}
