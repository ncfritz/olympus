import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { gmailConfig, type GmailConfigType } from "../config/configuration";
import type {
  CompleteGmailSignInRequest,
  GmailSignInResult,
  StartGmailSignInRequest,
} from "../model/gmail";
import { GmailAccountMismatchError } from "./GmailAccountMismatchError";
import { GmailCredentialStore } from "./GmailCredentialStore";

/**
 * Gmail's web sign-in (ADR 0028's consent flow, for mail; ADR 0030): the
 * API starts it for a signed-in user with its own state and PKCE challenge
 * and checks the state on the callback; this agent builds Google's URL,
 * exchanges the code with the client secret and keeps the refresh token.
 * The account must be the mailbox being linked: its verified address, and
 * once linked its subject.
 */
@Injectable()
export class GmailAuth {
  constructor(
    @Inject(gmailConfig.KEY) private readonly config: GmailConfigType,
    private readonly credentials: GmailCredentialStore,
  ) {}

  /** Google's consent URL for the mailbox. */
  start(request: StartGmailSignInRequest): string {
    const client = this.oauthClient(request.redirectUri);
    return client.generateAuthUrl({
      access_type: "offline",
      // A refresh token every time: Google sends one only on consent.
      prompt: "consent",
      scope: this.config.scopes ?? [],
      state: request.state,
      code_challenge: request.codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      login_hint: request.email,
    });
  }

  /**
   * Exchanges the callback's code and keeps the refresh token, once the
   * account is the mailbox's.
   *
   * @throws GmailAccountMismatchError another mailbox, or another subject
   * @throws Error a callback with no code, a state that does not match, or
   *   Google refusing the exchange
   */
  async complete(
    request: CompleteGmailSignInRequest,
  ): Promise<GmailSignInResult> {
    const code = codeFrom(request.callbackUrl, request.state);
    const client = this.oauthClient(request.redirectUri);
    const { tokens } = await client.getToken({
      code,
      codeVerifier: request.codeVerifier,
      redirect_uri: request.redirectUri,
    });
    if (!tokens.refresh_token) {
      throw new Error("Google did not return a refresh token");
    }
    if (!tokens.access_token) {
      throw new Error("Google did not return an access token");
    }
    const info = await client.getTokenInfo(tokens.access_token);
    const email = request.email.toLowerCase();
    const verified =
      info.email_verified === true ||
      (info.email_verified as unknown) === "true";
    if (!info.sub) throw new Error("Google did not say who signed in");
    if (!info.email || !verified || info.email.toLowerCase() !== email) {
      throw new GmailAccountMismatchError("email");
    }
    const stored = this.credentials.load(email);
    if (stored && stored.subject !== info.sub) {
      throw new GmailAccountMismatchError("subject");
    }
    const scope = tokens.scope ?? (this.config.scopes ?? []).join(" ");
    this.credentials.save({
      email,
      subject: info.sub,
      refreshToken: tokens.refresh_token,
      scope,
      obtainedAt: new Date().toISOString(),
    });
    return { email, subject: info.sub, scope, created: stored === undefined };
  }

  /** A client for one redirect URI; separate so tests can stand in. */
  oauthClient(redirectUri: string): OAuth2Client {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new ServiceUnavailableException(
        "Gmail's OAuth client is not configured (MAIL_GOOGLE_OAUTH_CLIENT_ID and _SECRET)",
      );
    }
    return new OAuth2Client(
      this.config.clientId,
      this.config.clientSecret,
      redirectUri,
    );
  }
}

/** The code of a callback whose state matches and which carries no error. */
const codeFrom = (callbackUrl: string, state: string): string => {
  const url = new URL(callbackUrl);
  const error = url.searchParams.get("error");
  if (error) throw new Error(`The sign-in was not completed: ${error}`);
  if (url.searchParams.get("state") !== state) {
    throw new Error("The sign-in's state does not match");
  }
  const code = url.searchParams.get("code");
  if (!code) throw new Error("The sign-in's redirect carried no code");
  return code;
};
