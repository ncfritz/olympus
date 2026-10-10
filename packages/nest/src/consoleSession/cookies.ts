import type { CookieOptions, Response } from "express";
import { isPublishedOverTls, sessionCookiePath } from "../auth/cookieScope";
import type { ConsoleSessionConfig } from "./config";

/** The console's three cookies (ADR 0029), named by its prefix. */
export const sessionCookieNames = (
  config: Pick<ConsoleSessionConfig, "cookiePrefix">,
) => ({
  /** The Olympus access token the console's browser session rides on. */
  access: `${config.cookiePrefix}_access_token`,
  /**
   * The Olympus refresh token: the API hands this client its refresh token
   * in the body, and the service keeps it where no script can read it.
   */
  refresh: `${config.cookiePrefix}_refresh_token`,
  /** The in-flight sign-in (state, PKCE verifier), between login and callback. */
  signIn: `${config.cookiePrefix}_sign_in_txn`,
});

/** Where the cookies are scoped and how they are secured: where the service and its console are published. */
export type SessionCookieConfig = Pick<
  ConsoleSessionConfig,
  "baseUrl" | "webAppUrl"
>;

/**
 * The options every session cookie is set *and cleared* with: a cookie is
 * only replaced by one with the same name, path and domain, so the two
 * have to agree.
 *
 * `sameSite: "lax"` and the console's own path are the console's choices;
 * the API's refresh cookie is `Strict` on `/api/v1/auth` (ADR 0018), which
 * is why only the scoping helpers are shared with it and not these options.
 */
export const sessionCookieOptions = (
  config: SessionCookieConfig,
): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: isPublishedOverTls(config.baseUrl),
  path: sessionCookiePath(config.webAppUrl),
});

/** What the API issued: an access token, its lifetime, and the refresh token. */
export interface SessionTokens {
  accessToken: string;
  /** Seconds. */
  expiresIn: number;
  refreshToken: string;
}

/**
 * The Olympus API's refresh tokens last thirty days (ADR 0018); the cookie
 * lasts as long. The API is what decides whether one still works.
 */
const REFRESH_TOKEN_COOKIE_MS = 30 * 24 * 60 * 60 * 1000;

/** Both session cookies, from a sign-in or a refresh. */
export const setSessionCookies = (
  response: Response,
  config: SessionCookieConfig & Pick<ConsoleSessionConfig, "cookiePrefix">,
  tokens: SessionTokens,
): void => {
  const cookie = sessionCookieOptions(config);
  const names = sessionCookieNames(config);
  response.cookie(names.access, tokens.accessToken, {
    ...cookie,
    maxAge: tokens.expiresIn * 1000,
  });
  response.cookie(names.refresh, tokens.refreshToken, {
    ...cookie,
    maxAge: REFRESH_TOKEN_COOKIE_MS,
  });
};

/** Both session cookies gone: signed out, or a session the API ended. */
export const clearSessionCookies = (
  response: Response,
  config: SessionCookieConfig & Pick<ConsoleSessionConfig, "cookiePrefix">,
): void => {
  const cookie = sessionCookieOptions(config);
  const names = sessionCookieNames(config);
  response.clearCookie(names.access, cookie);
  response.clearCookie(names.refresh, cookie);
};
