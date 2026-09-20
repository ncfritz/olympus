/** Scopes requested when obtaining (or renewing) a device-flow Google credential for calendar sync. */
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
];

/**
 * Scopes for authorizing a brand-new account, where — unlike a reauth for an
 * already-known account — we don't have an accountLabel yet: the extra email
 * scope lets us derive one from the signed-in address (see
 * CalendarAuthService.completeNewAccountAuth).
 */
export const GOOGLE_NEW_ACCOUNT_SCOPES = [
  ...GOOGLE_CALENDAR_SCOPES,
  "https://www.googleapis.com/auth/userinfo.email",
];
