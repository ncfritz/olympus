import { ApiProperty } from "@nestjs/swagger";

/**
 * ok: the refresh token is valid and sync can proceed as-is.
 * expired: Google rejected the refresh token — a new login is required.
 * reauth_pending: a new login flow was started and is waiting on the user to finish it in the tab that opened.
 * not_connected: no credential has ever been stored for this account.
 * error: the status check itself failed unexpectedly (network error, malformed response, ...).
 */
export type CalendarAccountAuthStatus = "ok" | "expired" | "reauth_pending" | "not_connected" | "error";

const STATUS_VALUES: CalendarAccountAuthStatus[] = ["ok", "expired", "reauth_pending", "not_connected", "error"];

export class CalendarAccountStatusDto {
  @ApiProperty({ description: "The stored-credential label this status describes (see google-credential-store / microsoft-credential-store)" })
  accountLabel: string;

  @ApiProperty({ description: "Which provider this account authorizes with", enum: ["google", "microsoft"] })
  provider: "google" | "microsoft";

  @ApiProperty({
    description: "Source labels of the configured calendars that authorize with this account",
    type: [String],
  })
  sources: string[];

  @ApiProperty({
    description: "Status of the device-flow OAuth credential backing this account's sync",
    enum: STATUS_VALUES,
  })
  status: CalendarAccountAuthStatus;

  @ApiProperty({ description: "OAuth scopes granted the last time this account completed the login flow", required: false })
  scope?: string;

  @ApiProperty({ description: "When the stored refresh token was obtained", required: false })
  obtainedAt?: string;

  @ApiProperty({
    description:
      "Expiry of the access token minted from the most recent check — google-auth-library mints a fresh one " +
      "automatically around this time whenever sync next runs, so this doubles as the 'next refresh' time.",
    required: false,
  })
  accessTokenExpiresAt?: string;

  @ApiProperty({ description: "Human-readable detail when status is 'expired' or 'error'", required: false })
  error?: string;
}
