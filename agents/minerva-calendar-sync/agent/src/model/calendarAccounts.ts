import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ValidateNested,
} from "class-validator";
import type { Moment } from "moment";
import {
  CALENDAR_ACCOUNT_AUTH_STATUS_VALUES,
  type CalendarAccountAuthStatus,
  NEW_ACCOUNT_AUTH_STATUS_VALUES,
  type NewAccountAuthStatus,
} from "../calendarAuth/types";
import { CALENDAR_PROVIDER_ENUM, CALENDAR_PROVIDER_VALUES } from "./common";

type CalendarProviderName = (typeof CALENDAR_PROVIDER_VALUES)[number];

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A calendar account (a stored OAuth credential) and its status. */
export class CalendarAccount {
  @ApiProperty({
    type: String,
    required: true,
    description: "The account's label: its email address",
  })
  accountLabel: string;

  @ApiProperty({
    ...CALENDAR_PROVIDER_ENUM,
    required: true,
    description: "The provider the account authorizes with",
  })
  provider: CalendarProviderName;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "The source labels of the synced calendars that authorize with the account",
  })
  sources: string[];

  @ApiProperty({
    enum: [...CALENDAR_ACCOUNT_AUTH_STATUS_VALUES],
    enumName: "CalendarAccountAuthStatus",
    required: true,
    description:
      "The credential's status: ok, expired (a new sign-in is needed), reauth_pending, not_connected or error",
  })
  status: CalendarAccountAuthStatus;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The account's permanent ID at its provider (Google's sub; Microsoft's <tid>:<oid>), once recorded",
  })
  subject?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The OAuth scopes granted at the last sign-in",
  })
  scope?: string;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the stored refresh token was obtained",
  })
  obtainedAt?: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the access token from the latest check expires (and the next sync refreshes it)",
  })
  accessTokenExpiresAt?: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description: "What went wrong, when the status is expired or error",
  })
  error?: string;
}

/** A calendar the provider reports for an account. */
export class AvailableCalendar {
  @ApiProperty({
    type: String,
    required: true,
    description: 'The provider\'s ID of the calendar (e.g. "primary")',
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The calendar's name, as the provider shows it",
  })
  summary: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the calendar is already synced",
  })
  alreadySynced: boolean;
}

/** A sign-in that connects a new calendar account. */
export class CalendarAccountAuthorization {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the authorization",
  })
  authorizationId: string;

  @ApiProperty({
    enum: [...NEW_ACCOUNT_AUTH_STATUS_VALUES],
    enumName: "CalendarAccountAuthorizationStatus",
    required: true,
    description:
      "pending while the user signs in, then success (see accountLabel) or error",
  })
  status: NewAccountAuthStatus;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The URL to open in a browser to sign in (returned when the authorization is created)",
  })
  authUrl?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The connected account's label, once the status is success",
  })
  accountLabel?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "What went wrong, when the status is error",
  })
  error?: string;
}

/** A sign-in that renews an existing account's access. */
export class CalendarAccountReauthorization {
  @ApiProperty({
    type: String,
    required: true,
    description: "The URL to open in a browser to grant access again",
  })
  authUrl: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Partial and Derived Types                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

export class BaseCalendarAccountAuthorization {
  @ApiProperty({
    ...CALENDAR_PROVIDER_ENUM,
    required: true,
    description: "The provider to connect an account of",
  })
  @IsIn(CALENDAR_PROVIDER_VALUES)
  provider: CalendarProviderName;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateCalendarAccountAuthorizationRequest {
  @ApiProperty({
    type: () => BaseCalendarAccountAuthorization,
    required: true,
    description: "The authorization to start.",
  })
  @ValidateNested()
  @Type(() => BaseCalendarAccountAuthorization)
  calendarAccountAuthorization: BaseCalendarAccountAuthorization;
}

/** Which provider's account is meant, when the same label is connected under more than one. */
export class CalendarAccountProviderQuery {
  @ApiProperty({
    ...CALENDAR_PROVIDER_ENUM,
    required: false,
    description:
      "The account's provider; needed only when the same account label is connected under more than one",
  })
  @IsOptional()
  @IsIn(CALENDAR_PROVIDER_VALUES)
  provider?: CalendarProviderName;
}

/** Which provider's account to delete: required, since a deletion must not guess. */
export class CalendarAccountRemovalQuery {
  @ApiProperty({
    ...CALENDAR_PROVIDER_ENUM,
    required: true,
    description: "The account's provider",
  })
  @IsIn(CALENDAR_PROVIDER_VALUES)
  provider: CalendarProviderName;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListCalendarAccountsResponse {
  @ApiProperty({
    type: () => CalendarAccount,
    isArray: true,
    required: true,
    description: "The calendar accounts.",
  })
  calendarAccounts: CalendarAccount[];
}

export class CreateCalendarAccountAuthorizationResponse {
  @ApiProperty({
    type: () => CalendarAccountAuthorization,
    required: true,
    description: "The started authorization, with the URL to sign in at.",
  })
  calendarAccountAuthorization: CalendarAccountAuthorization;
}

export class DescribeCalendarAccountAuthorizationResponse {
  @ApiProperty({
    type: () => CalendarAccountAuthorization,
    required: true,
    description: "The authorization's outcome so far.",
  })
  calendarAccountAuthorization: CalendarAccountAuthorization;
}

export class ReauthorizeCalendarAccountResponse {
  @ApiProperty({
    type: () => CalendarAccountReauthorization,
    required: true,
    description: "The started reauthorization.",
  })
  reauthorization: CalendarAccountReauthorization;
}

export class ListAvailableCalendarsResponse {
  @ApiProperty({
    type: () => AvailableCalendar,
    isArray: true,
    required: true,
    description: "The account's calendars.",
  })
  availableCalendars: AvailableCalendar[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Web sign-ins (ADR 0028): started and redeemed by the Olympus API                                                   */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A sign-in the Olympus API starts at the provider, for one of its users. */
export class BaseCalendarAccountWebSignIn {
  @ApiProperty({
    ...CALENDAR_PROVIDER_ENUM,
    required: true,
    description: "The provider to sign in at",
  })
  @IsIn(CALENDAR_PROVIDER_VALUES)
  provider: CalendarProviderName;

  @ApiProperty({
    type: String,
    required: true,
    description: "The Olympus API's callback URL, registered with the provider",
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  redirectUri: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The state the callback must carry back",
  })
  @IsString()
  @Length(16, 200)
  state: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The PKCE challenge (S256) of the verifier the API keeps",
  })
  @IsString()
  @Length(43, 128)
  codeChallenge: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The label of a stored account to sign in again; none connects a new one",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  accountLabel?: string;
}

/** The provider's redirect back to the Olympus API, to redeem. */
export class CalendarAccountWebSignInCallback {
  @ApiProperty({
    ...CALENDAR_PROVIDER_ENUM,
    required: true,
    description: "The provider signed in at",
  })
  @IsIn(CALENDAR_PROVIDER_VALUES)
  provider: CalendarProviderName;

  @ApiProperty({
    type: String,
    required: true,
    description: "The whole URL the provider redirected to",
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  callbackUrl: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The callback URL the sign-in was started with",
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  redirectUri: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The state the sign-in was started with",
  })
  @IsString()
  @Length(16, 200)
  state: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The PKCE verifier of the sign-in's challenge",
  })
  @IsString()
  @Length(43, 128)
  codeVerifier: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The label of the stored account being signed in again; another account signing in is refused",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  accountLabel?: string;
}

/** Who signed in. */
export class CalendarAccountWebSignInResult {
  @ApiProperty({
    ...CALENDAR_PROVIDER_ENUM,
    required: true,
    description: "The account's provider",
  })
  provider: CalendarProviderName;

  @ApiProperty({
    type: String,
    required: true,
    description: "The account's label: its verified email",
  })
  accountLabel: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The account's subject at the provider",
  })
  subject?: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the agent held no credential for the account before this sign-in",
  })
  created: boolean;
}

export class StartCalendarAccountWebSignInRequest {
  @ApiProperty({
    type: () => BaseCalendarAccountWebSignIn,
    required: true,
    description: "The sign-in to start.",
  })
  @ValidateNested()
  @Type(() => BaseCalendarAccountWebSignIn)
  webSignIn: BaseCalendarAccountWebSignIn;
}

export class StartCalendarAccountWebSignInResponse {
  @ApiProperty({
    type: String,
    required: true,
    description: "The provider's URL to send the browser to.",
  })
  authUrl: string;
}

export class CompleteCalendarAccountWebSignInRequest {
  @ApiProperty({
    type: () => CalendarAccountWebSignInCallback,
    required: true,
    description: "The provider's redirect.",
  })
  @ValidateNested()
  @Type(() => CalendarAccountWebSignInCallback)
  callback: CalendarAccountWebSignInCallback;
}

export class CompleteCalendarAccountWebSignInResponse {
  @ApiProperty({
    type: () => CalendarAccountWebSignInResult,
    required: true,
    description: "The account that signed in.",
  })
  calendarAccount: CalendarAccountWebSignInResult;
}
