import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The provider a calendar account signs in with. */
export enum CalendarProvider {
  Google = "google",
  Microsoft = "microsoft",
}

/** How a user proved a calendar account is theirs (ADR 0028). */
export enum CalendarAccountVerification {
  /** It is the account they sign in to Olympus with. */
  SignIn = "sign_in",
  /** They signed in to it from Olympus. */
  Consent = "consent",
  /** They confirmed a link mailed to its address. */
  ClaimEmail = "claim_email",
  /** They claimed it by signing in to it from Olympus. */
  ClaimConsent = "claim_consent",
}

/** The state of a calendar account's stored credential, as the sync agent reports it. */
export enum CalendarAccountStatus {
  Ok = "ok",
  /** A new sign-in is needed. */
  Expired = "expired",
  /** A sign-in is in progress. */
  ReauthPending = "reauth_pending",
  /** The agent holds no credential for it. */
  NotConnected = "not_connected",
  Error = "error",
  /** The agent could not be asked. */
  Unknown = "unknown",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * One of the user's calendar accounts (ADR 0028): a sign-in at a provider,
 * proven to be theirs, whose calendars the sync agent keeps in Minerva.
 */
export class CalendarAccount {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the account",
  })
  id: string;

  @ApiProperty({
    enum: () => CalendarProvider,
    enumName: "CalendarProvider",
    enumSchema: {
      description: "The provider a calendar account signs in with",
    },
    required: true,
    description: "The provider the account signs in with",
  })
  provider: CalendarProvider;

  @ApiProperty({
    type: String,
    required: true,
    description: "The account's verified email when it signed in",
  })
  email: string;

  @ApiProperty({
    enum: () => CalendarAccountStatus,
    enumName: "CalendarAccountStatus",
    required: true,
    description: "The state of the account's stored credential",
  })
  status: CalendarAccountStatus;

  @ApiProperty({
    type: String,
    required: false,
    description: "What went wrong, when the status is expired or error",
  })
  error?: string;

  @ApiProperty({
    enum: () => CalendarAccountVerification,
    enumName: "CalendarAccountVerification",
    required: true,
    description: "How the user proved the account is theirs",
  })
  verification: CalendarAccountVerification;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the account was proven to be the user's",
  })
  verifiedTime: Moment;
}

/** A calendar of one of the user's accounts that the sync agent keeps in Minerva. */
export class Calendar {
  @ApiProperty({
    type: String,
    required: true,
    description: "The provider's ID of the calendar",
  })
  calendarId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the account the calendar belongs to",
  })
  accountId: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The calendar's source label: it names the calendar's events, and is unique across every calendar synced",
  })
  source: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the calendar syncs",
  })
  enabled: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the calendar's events count toward availability",
  })
  includedInBusy: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether at least one full sync has completed",
  })
  synced: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether a sync of the calendar is running",
  })
  syncing: boolean;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when a sync of the calendar last completed",
  })
  lastSyncedTime?: Moment;
}

/** A calendar an account's provider reports, synced or not. */
export class AvailableCalendar {
  @ApiProperty({
    type: String,
    required: true,
    description: "The provider's ID of the calendar",
  })
  calendarId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The calendar's name, as the provider shows it",
  })
  name: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the calendar is already synced",
  })
  synced: boolean;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Partial and Derived Types                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A sign-in at a provider to connect a new account. */
export class BaseCalendarAccountConnection {
  @ApiProperty({
    enum: () => CalendarProvider,
    enumName: "CalendarProvider",
    enumSchema: {
      description: "The provider a calendar account signs in with",
    },
    required: true,
    description: "The provider to sign in at",
  })
  provider: CalendarProvider;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The site page to send the browser back to; its origin must be one of the API's client origins",
  })
  returnTo: string;
}

/** A sign-in at a provider for an account the user already has. */
export class CalendarAccountReauthorization {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The site page to send the browser back to; its origin must be one of the API's client origins",
  })
  returnTo: string;
}

/** The provider's page to send the browser to. */
export class CalendarAccountSignIn {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The provider's sign-in URL; the browser returns to the site page afterwards",
  })
  authUrl: string;
}

/** A calendar to start syncing. */
export class BaseCalendar {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The provider's ID of the calendar, from ListAvailableCalendars",
  })
  calendarId: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The calendar's source label, 1 to 64 characters; another calendar already having it is a conflict",
  })
  source: string;
}

/** The settings of a calendar to change; only what is named changes. */
export class PartialCalendar {
  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Whether the calendar syncs",
  })
  enabled?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Whether the calendar's events count toward availability",
  })
  includedInBusy?: boolean;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ConnectCalendarAccountRequest {
  @ApiProperty({
    type: () => BaseCalendarAccountConnection,
    required: true,
    description: "The sign-in to start.",
  })
  connection: BaseCalendarAccountConnection;
}

export class ReauthorizeCalendarAccountRequest {
  @ApiProperty({
    type: () => CalendarAccountReauthorization,
    required: true,
    description: "The sign-in to start.",
  })
  reauthorization: CalendarAccountReauthorization;
}

export class AddCalendarRequest {
  @ApiProperty({
    type: () => BaseCalendar,
    required: true,
    description: "The calendar to start syncing.",
  })
  calendar: BaseCalendar;
}

export class UpdateCalendarRequest {
  @ApiProperty({
    type: () => PartialCalendar,
    required: true,
    description: "The changes to the calendar.",
  })
  calendar: PartialCalendar;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListCalendarAccountsResponse {
  @ApiProperty({
    type: () => CalendarAccount,
    isArray: true,
    required: true,
    description: "The caller's calendar accounts.",
  })
  calendarAccounts: CalendarAccount[];
}

export class DescribeCalendarAccountResponse {
  @ApiProperty({
    type: () => CalendarAccount,
    required: true,
    description: "The calendar account.",
  })
  calendarAccount: CalendarAccount;
}

export class CalendarAccountSignInResponse {
  @ApiProperty({
    type: () => CalendarAccountSignIn,
    required: true,
    description: "Where to send the browser.",
  })
  signIn: CalendarAccountSignIn;
}

export class ListAvailableCalendarsResponse {
  @ApiProperty({
    type: () => AvailableCalendar,
    isArray: true,
    required: true,
    description: "The account's calendars at its provider.",
  })
  availableCalendars: AvailableCalendar[];
}

export class ListCalendarsResponse {
  @ApiProperty({
    type: () => Calendar,
    isArray: true,
    required: true,
    description: "The caller's synced calendars.",
  })
  calendars: Calendar[];
}

export class SingleCalendarResponse {
  @ApiProperty({
    type: () => Calendar,
    required: true,
    description: "The calendar.",
  })
  calendar: Calendar;
}
