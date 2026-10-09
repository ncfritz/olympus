import { Injectable } from "@nestjs/common";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
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
  type WebSignInCallback,
  type WebSignInResult,
  type WebSignInStart,
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

  async startWebSignIn(start: WebSignInStart): Promise<string> {
    const client = this.webClient(start.redirectUri);
    return client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_NEW_ACCOUNT_SCOPES,
      state: start.state,
      code_challenge: start.codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      ...(start.loginHint ? { login_hint: start.loginHint } : {}),
    });
  }

  async completeWebSignIn(
    callback: WebSignInCallback,
  ): Promise<WebSignInResult> {
    const code = codeFrom(callback);
    const client = this.webClient(callback.redirectUri);
    const { tokens } = await client.getToken({
      code,
      codeVerifier: callback.codeVerifier,
      redirect_uri: callback.redirectUri,
    });
    if (!tokens.refresh_token) {
      throw new Error("Google did not return a refresh token");
    }
    if (!tokens.access_token) {
      throw new Error("Google did not return an access token");
    }
    const identity = await readIdentity(client, tokens.access_token);

    let accountLabel: string;
    if (callback.accountLabel === undefined) {
      if (!identity.email) {
        throw new Error(
          "Google did not return a verified email address for this account",
        );
      }
      accountLabel = identity.email;
    } else {
      confirmSameAccount(
        callback.accountLabel,
        this.credentials.tryLoad(callback.accountLabel)?.subject,
        identity,
      );
      accountLabel = callback.accountLabel;
    }

    const created = this.credentials.tryLoad(accountLabel) === undefined;
    this.credentials.save({
      accountLabel,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope ?? GOOGLE_NEW_ACCOUNT_SCOPES.join(" "),
      obtainedAt: new Date().toISOString(),
      subject: identity.subject,
      client: "web",
    });
    return { accountLabel, subject: identity.subject, created };
  }

  removeCredential(accountLabel: string): void {
    this.credentials.remove(accountLabel);
  }

  private webClient(redirectUri: string): OAuth2Client {
    const { clientId, clientSecret } = this.credentials.oauthClient("web");
    return new OAuth2Client(clientId, clientSecret, redirectUri);
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

/**
 * The code of a provider's redirect, once its state is the one the sign-in
 * started with and it carries no error.
 */
function codeFrom(callback: WebSignInCallback): string {
  const url = new URL(callback.callbackUrl);
  const error = url.searchParams.get("error");
  if (error) throw new Error(`The sign-in was not completed: ${error}`);
  if (url.searchParams.get("state") !== callback.state) {
    throw new Error("The sign-in's state does not match");
  }
  const code = url.searchParams.get("code");
  if (!code) throw new Error("The sign-in's redirect carried no code");
  return code;
}

/** The account behind an access token: its subject, and its email when Google has verified it. */
async function readIdentity(
  client: OAuth2Client,
  accessToken: string,
): Promise<AccountIdentity> {
  const info = await client.getTokenInfo(accessToken);
  return {
    subject: info.sub,
    email:
      info.email && isVerified(info.email_verified) ? info.email : undefined,
  };
}

/**
 * Whether token info says the email is verified. Google's tokeninfo
 * endpoint answers `"email_verified": "true"`, a string, though the
 * library's type says boolean and passes the body through as it is; an ID
 * token's claim is a boolean. Either means verified.
 */
function isVerified(value: unknown): boolean {
  return value === true || value === "true";
}

function googleErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { error?: string } } })?.response?.data
    ?.error;
}
