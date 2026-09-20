import type * as OpenIdClient from "openid-client";
import { loadOpenIdClient } from "../../auth/openid-client-loader";
import {
  findFreePort,
  waitForAuthorizationCallback,
} from "../shared/oauth-loopback-server";
import {
  loadMicrosoftCredential,
  requireEnv,
} from "./microsoft-credential-store";

/** Scopes requested when obtaining (or renewing) a Microsoft credential for calendar sync. */
export const MICROSOFT_CALENDAR_SCOPES = [
  "offline_access",
  "https://graph.microsoft.com/Calendars.Read",
];

/**
 * Scopes for authorizing a brand-new account, where — unlike a reauth for an
 * already-known account — we don't have an accountLabel yet: the extra
 * openid/email scopes let us derive one from the signed-in address (see
 * MicrosoftAuthStrategy.completeNewAccountAuth), mirroring
 * GOOGLE_NEW_ACCOUNT_SCOPES.
 */
export const MICROSOFT_NEW_ACCOUNT_SCOPES = [
  ...MICROSOFT_CALENDAR_SCOPES,
  "openid",
  "email",
];

let discoveryPromise: Promise<OpenIdClient.Configuration> | undefined;

/**
 * Microsoft identity platform v2.0 discovery for MICROSOFT_OAUTH_TENANT_ID
 * (default "common", which accepts both work/school and personal Microsoft
 * accounts). Cached for the process lifetime — same one app registration is
 * used for every account label.
 *
 * A loopback-redirect "Mobile and desktop applications" registration is a
 * *public* client — PKCE is its whole security story, and Entra ID actively
 * rejects a token request that also carries a client_secret (AADSTS700025:
 * "Client is public so neither 'client_assertion' nor 'client_secret' should
 * be presented"). client.None() tells openid-client not to send one, even
 * though a secret may still exist on the app registration (some registration
 * flows generate one regardless of platform type).
 */
function getOidcConfig(
  client: typeof OpenIdClient,
): Promise<OpenIdClient.Configuration> {
  if (!discoveryPromise) {
    const tenant = process.env["MICROSOFT_OAUTH_TENANT_ID"] || "common";
    discoveryPromise = client.discovery(
      new URL(`https://login.microsoftonline.com/${tenant}/v2.0`),
      requireEnv("MICROSOFT_OAUTH_CLIENT_ID"),
      undefined,
      client.None(),
    );
  }
  return discoveryPromise;
}

export interface MicrosoftTokenResult {
  refreshToken: string;
  scope: string;
  /** Only present when `openid`/`email` were requested (new-account authorization). */
  email?: string;
}

export interface MicrosoftLoopbackFlow {
  authUrl: string;
  redirectUri: string;
  /** Waits for the browser redirect, then exchanges the code for tokens. */
  complete(timeoutMs?: number): Promise<MicrosoftTokenResult>;
}

/**
 * Starts a loopback-redirect OAuth flow against Microsoft — the same RFC
 * 8252 mechanism as the Google flow (see google-loopback-auth.ts), but
 * driven through openid-client's PKCE + authorization-code-grant helpers
 * (already used for this app's own login OIDC — see ../../auth) instead of
 * google-auth-library's OAuth2Client, since Microsoft's endpoints are plain
 * OIDC rather than a bespoke client library.
 */
export async function startMicrosoftLoopbackFlow(
  scopes: string[],
): Promise<MicrosoftLoopbackFlow> {
  const client = await loadOpenIdClient();
  const oidcConfig = await getOidcConfig(client);

  const port = await findFreePort();
  // Unlike Google (which wants the loopback IP literal, 127.0.0.1, per RFC
  // 8252), Microsoft's "Mobile and desktop applications" platform only
  // wildcards the port for the exact registered redirect URI "http://localhost"
  // — a 127.0.0.1 redirect_uri is rejected as a mismatch even though it's the
  // same machine. "localhost" resolves to the loopback interface our server
  // binds to either way, so this is just a hostname-string requirement.
  //
  // The trailing slash matters too: at token-exchange time, openid-client
  // derives the redirect_uri it sends to the token endpoint by stripping the
  // query string off the actual callback URL (see oauth4webapi's
  // authorizationCodeGrant, `redirectUri = stripParams(currentUrl)`) — and a
  // bare "http://localhost:PORT" callback always has an implicit "/" path,
  // so the derived value is "http://localhost:PORT/". Without the slash
  // here too, that mismatches the redirect_uri from the original authorize
  // request byte-for-byte, and Microsoft's consumer/MSA token endpoint
  // rejects it (AADSTS70000) — the org-tenant endpoint was observed to
  // tolerate the mismatch, but nothing about the spec promises that.
  const redirectUri = `http://localhost:${port}/`;

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();

  const authUrl = client.buildAuthorizationUrl(oidcConfig, {
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    // Forces a fresh consent/refresh_token, mirroring Google's prompt: "consent" —
    // without it, a returning user can get a code-for-token exchange with no refresh_token.
    prompt: "consent",
  });

  return {
    authUrl: authUrl.href,
    redirectUri,
    async complete(timeoutMs?: number) {
      const callbackUrl = await waitForAuthorizationCallback(
        redirectUri,
        timeoutMs,
      );
      let tokenResponse: Awaited<
        ReturnType<typeof client.authorizationCodeGrant>
      >;
      try {
        tokenResponse = await client.authorizationCodeGrant(
          oidcConfig,
          callbackUrl,
          {
            pkceCodeVerifier: codeVerifier,
            expectedState: state,
          },
        );
      } catch (error) {
        throw new Error(
          `Microsoft token exchange failed: ${describeTokenError(error)}`,
          { cause: error },
        );
      }

      if (!tokenResponse.refresh_token) {
        throw new Error(
          "Microsoft did not return a refresh token. Remove Minerva's access under " +
            "https://myaccount.microsoft.com/organizations (or https://account.live.com/consent/Manage for a " +
            "personal account) and try again.",
        );
      }

      const claims = tokenResponse.claims();
      return {
        refreshToken: tokenResponse.refresh_token,
        scope: tokenResponse.scope ?? scopes.join(" "),
        email: typeof claims?.email === "string" ? claims.email : undefined,
      };
    },
  };
}

/** Extracts the OAuth error code/description oauth4webapi's ResponseBodyError carries, falling back to the plain message. */
function describeTokenError(error: unknown): string {
  const err = error as {
    error?: string;
    error_description?: string;
    message?: string;
  };
  if (err?.error) {
    return err.error_description
      ? `${err.error}: ${err.error_description}`
      : err.error;
  }
  return err?.message ?? String(error);
}

/** Mints a fresh access token from a stored refresh token. Microsoft access tokens are short-lived (~1h) and never cached to disk. */
export async function refreshMicrosoftAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt?: string }> {
  const client = await loadOpenIdClient();
  const oidcConfig = await getOidcConfig(client);
  const tokenResponse = await client.refreshTokenGrant(
    oidcConfig,
    refreshToken,
  );

  return {
    accessToken: tokenResponse.access_token,
    expiresAt: tokenResponse.expiresIn()
      ? new Date(Date.now() + tokenResponse.expiresIn()! * 1000).toISOString()
      : undefined,
  };
}

export interface MicrosoftAccessTokenProvider {
  getAccessToken(): Promise<string>;
}

/**
 * Builds an access-token provider for `accountLabel`, ready to pass into
 * MicrosoftCalendarProvider. Unlike Google (whose OAuth2Client refreshes and
 * caches access tokens internally), Graph calls need a bearer token handed
 * in per request, so this mints one from the stored refresh token and caches
 * it in memory until shortly before it expires.
 */
export function createAuthorizedMicrosoftClient(
  accountLabel: string,
): MicrosoftAccessTokenProvider {
  let cached: { accessToken: string; expiresAtMs: number } | undefined;

  return {
    async getAccessToken(): Promise<string> {
      if (cached && cached.expiresAtMs - Date.now() > 60_000) {
        return cached.accessToken;
      }

      const credential = loadMicrosoftCredential(accountLabel);
      const { accessToken, expiresAt } = await refreshMicrosoftAccessToken(
        credential.refreshToken,
      );
      cached = {
        accessToken,
        expiresAtMs: expiresAt
          ? Date.parse(expiresAt)
          : Date.now() + 55 * 60 * 1000,
      };
      return accessToken;
    },
  };
}
