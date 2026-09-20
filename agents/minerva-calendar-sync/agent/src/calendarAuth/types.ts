/**
 * ok: the refresh token is valid and sync can proceed as-is.
 * expired: the provider rejected the refresh token — a new login is required.
 * reauth_pending: a new login flow was started and is waiting on the user to finish it in the tab that opened.
 * not_connected: no credential has ever been stored for this account.
 * error: the status check itself failed unexpectedly (network error, malformed response, ...).
 */
export const CALENDAR_ACCOUNT_AUTH_STATUS_VALUES = [
  "ok",
  "expired",
  "reauth_pending",
  "not_connected",
  "error",
] as const;
export type CalendarAccountAuthStatus =
  (typeof CALENDAR_ACCOUNT_AUTH_STATUS_VALUES)[number];

/** pending: waiting on the user to finish signing in; success: connected; error: the flow failed. */
export const NEW_ACCOUNT_AUTH_STATUS_VALUES = [
  "pending",
  "success",
  "error",
] as const;
export type NewAccountAuthStatus =
  (typeof NEW_ACCOUNT_AUTH_STATUS_VALUES)[number];

/** A connected (or configured but not yet connected) calendar account and its credential's status. */
export interface CalendarAccountStatus {
  accountLabel: string;
  provider: "google" | "microsoft";
  /** Source labels of the configured calendars that authorize with this account. */
  sources: string[];
  status: CalendarAccountAuthStatus;
  /** OAuth scopes granted the last time the account completed the login flow. */
  scope?: string;
  /** ISO-8601: when the stored refresh token was obtained. */
  obtainedAt?: string;
  /** ISO-8601: expiry of the access token minted by the most recent check. */
  accessTokenExpiresAt?: string;
  /** Detail when status is "expired" or "error". */
  error?: string;
}

export interface NewAccountAuthResult {
  status: NewAccountAuthStatus;
  /** The new account's label (its email address) once status is "success". */
  accountLabel?: string;
  /** Detail when status is "error". */
  error?: string;
}

/** One calendar the provider reports for an account, whether or not it's already being synced. */
export interface AvailableCalendarInfo {
  id: string;
  summary: string;
  alreadySynced: boolean;
}
