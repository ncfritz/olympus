import { Injectable } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";
import { GoogleCredentialStore } from "../../providers/google/GoogleCredentialStore";
import {
  createLoopbackClient,
  waitForAuthorizationCode,
} from "../../providers/google/googleLoopbackAuth";
import { GOOGLE_NEW_ACCOUNT_SCOPES } from "../../providers/google/googleOauthScopes";
import { type AccountIdentity, confirmSameAccount } from "../accountIdentity";
import {
  CalendarAuthStrategy,
  LoopbackFlow,
  LoopbackFlowRequest,
} from "./calendarAuthStrategy";

@Injectable()
export class GoogleAuthStrategy implements CalendarAuthStrategy {
  readonly provider = "google" as const;

  constructor(private readonly credentials: GoogleCredentialStore) {}

  listStoredAccountLabels(): string[] {
    return this.credentials.listAccountLabels();
  }

  tryLoadCredential(accountLabel: string) {
    return this.credentials.tryLoad(accountLabel);
  }

  async checkAccessToken(
    accountLabel: string,
  ): Promise<{ expiresAt?: string }> {
    const client = this.credentials.createAuthorizedClient(accountLabel);
    await client.getAccessToken();
    const expiry = client.credentials.expiry_date;
    return { expiresAt: expiry ? new Date(expiry).toISOString() : undefined };
  }

  async recordSubject(accountLabel: string): Promise<string | undefined> {
    const credential = this.credentials.tryLoad(accountLabel);
    if (!credential) return undefined;
    if (credential.subject) return credential.subject;
    const client = this.credentials.createAuthorizedClient(accountLabel);
    const { token } = await client.getAccessToken();
    if (!token) return undefined;
    const { subject } = await readIdentity(client, token);
    if (subject) this.credentials.save({ ...credential, subject });
    return subject;
  }

  async startLoopbackFlow(request: LoopbackFlowRequest): Promise<LoopbackFlow> {
    const { clientId, clientSecret } = this.credentials.oauthClient();
    const { client, redirectUri } = await createLoopbackClient(
      clientId,
      clientSecret,
    );
    const scopes = GOOGLE_NEW_ACCOUNT_SCOPES;
    const authUrl = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: scopes,
    });

    return {
      authUrl,
      complete: (timeoutMs) =>
        this.complete(request, client, redirectUri, scopes, timeoutMs),
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

    if (!tokens.access_token) {
      throw new Error("Google did not return an access token");
    }
    const identity = await readIdentity(client, tokens.access_token);

    let accountLabel: string;
    if (request.mode === "new") {
      if (!identity.email) {
        throw new Error(
          "Google did not return a verified email address for this account",
        );
      }
      accountLabel = identity.email;
    } else {
      confirmSameAccount(
        request.accountLabel,
        this.credentials.tryLoad(request.accountLabel)?.subject,
        identity,
      );
      accountLabel = request.accountLabel;
    }

    const scope = tokens.scope ?? scopes.join(" ");
    this.credentials.save({
      accountLabel,
      refreshToken: tokens.refresh_token,
      scope,
      obtainedAt: new Date().toISOString(),
      subject: identity.subject,
    });
    return { accountLabel, scope };
  }

  isInvalidGrantError(error: unknown): boolean {
    return googleErrorCode(error) === "invalid_grant";
  }

  errorMessage(error: unknown): string {
    const data = (
      error as {
        response?: { data?: { error?: string; error_description?: string } };
      }
    )?.response?.data;
    if (data?.error) {
      return data.error_description
        ? `${data.error}: ${data.error_description}`
        : data.error;
    }
    return error instanceof Error ? error.message : String(error);
  }
}

/** The account behind an access token: its subject, and its email when Google has verified it. */
async function readIdentity(
  client: OAuth2Client,
  accessToken: string,
): Promise<AccountIdentity> {
  const info = await client.getTokenInfo(accessToken);
  return {
    subject: info.sub,
    email: info.email && info.email_verified === true ? info.email : undefined,
  };
}

function googleErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { error?: string } } })?.response?.data
    ?.error;
}
