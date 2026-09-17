import { OAuth2Client } from "google-auth-library";
import {
  createAuthorizedGoogleClient,
  listStoredAccountLabels,
  requireEnv,
  saveGoogleCredential,
  tryLoadGoogleCredential,
} from "../../providers/google/google-credential-store";
import { createLoopbackClient, waitForAuthorizationCode } from "../../providers/google/google-loopback-auth";
import { GOOGLE_CALENDAR_SCOPES, GOOGLE_NEW_ACCOUNT_SCOPES } from "../../providers/google/google-oauth-scopes";
import { CalendarAuthStrategy, LoopbackFlow, LoopbackFlowRequest } from "./calendar-auth-strategy";

export class GoogleAuthStrategy implements CalendarAuthStrategy {
  readonly provider = "google" as const;

  listStoredAccountLabels(): string[] {
    return listStoredAccountLabels();
  }

  tryLoadCredential(accountLabel: string) {
    return tryLoadGoogleCredential(accountLabel);
  }

  async checkAccessToken(accountLabel: string): Promise<{ expiresAt?: string }> {
    const client = createAuthorizedGoogleClient(accountLabel);
    await client.getAccessToken();
    const expiry = client.credentials.expiry_date;
    return { expiresAt: expiry ? new Date(expiry).toISOString() : undefined };
  }

  async startLoopbackFlow(request: LoopbackFlowRequest): Promise<LoopbackFlow> {
    const { client, redirectUri } = await createLoopbackClient(
      requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
      requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    );
    const scopes = request.mode === "new" ? GOOGLE_NEW_ACCOUNT_SCOPES : GOOGLE_CALENDAR_SCOPES;
    const authUrl = client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: scopes });

    return {
      authUrl,
      complete: (timeoutMs) => this.complete(request, client, redirectUri, scopes, timeoutMs),
    };
  }

  private async complete(
    request: LoopbackFlowRequest,
    client: OAuth2Client,
    redirectUri: string,
    scopes: string[],
    timeoutMs: number,
  ): Promise<{ accountLabel: string; scope: string }> {
    const code = await waitForAuthorizationCode(redirectUri, timeoutMs);
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error(
        "Google did not return a refresh token. Revoke Minerva's access at " +
          "https://myaccount.google.com/permissions and try again.",
      );
    }

    let accountLabel: string;
    if (request.mode === "new") {
      if (!tokens.access_token) {
        throw new Error("Google did not return an access token");
      }
      const info = await client.getTokenInfo(tokens.access_token);
      if (!info.email || info.email_verified !== true) {
        throw new Error("Google did not return a verified email address for this account");
      }
      accountLabel = info.email;
    } else {
      accountLabel = request.accountLabel;
    }

    const scope = tokens.scope ?? scopes.join(" ");
    saveGoogleCredential({ accountLabel, refreshToken: tokens.refresh_token, scope, obtainedAt: new Date().toISOString() });
    return { accountLabel, scope };
  }

  isInvalidGrantError(error: unknown): boolean {
    return googleErrorCode(error) === "invalid_grant";
  }

  errorMessage(error: unknown): string {
    const data = (error as { response?: { data?: { error?: string; error_description?: string } } })?.response?.data;
    if (data?.error) {
      return data.error_description ? `${data.error}: ${data.error_description}` : data.error;
    }
    return error instanceof Error ? error.message : String(error);
  }
}

function googleErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
}
