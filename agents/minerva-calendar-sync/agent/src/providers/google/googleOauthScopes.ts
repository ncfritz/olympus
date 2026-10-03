/** Scopes requested when obtaining (or renewing) a device-flow Google credential for calendar sync. */
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
];

/**
 * Scopes for every sign-in from the agent, new account or re-authorization:
 * calendar access plus the identity of who signed in. A new account takes
 * its label from the verified email; a re-authorization is refused unless
 * the same account signed in (see confirmSameAccount). The bare calendar
 * scope stays for the command-line setup script.
 */
export const GOOGLE_NEW_ACCOUNT_SCOPES = [
  ...GOOGLE_CALENDAR_SCOPES,
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
];
