import { isPublishedOverTls, sessionCookiePath } from "@ncfritz/olympus-nest";
import type { CookieOptions, Response } from "express";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./authConstants";

/** Re-exported: callers here have always imported it from this module. */
export { sessionCookiePath };

/** What the cookies are scoped and secured by: where this agent and its console are published. */
export interface SessionCookieConfig {
  /** AUTH_BASE_URL: where the browser reaches this agent. */
  baseUrl: string;
  /** WEB_APP_URL: where the browser reaches its console. */
  webAppUrl?: string;
}

/**
 * The options every session cookie is set *and cleared* with: a cookie is
 * only replaced by one with the same name, path and domain, so the two
 * have to agree.
 *
 * `sameSite: "lax"` and the console's own path are this console's choices;
 * the API's refresh cookie is `Strict` on `/api/v1/auth` (ADR 0018), which
 * is why only the scoping helpers are shared and not these options.
 */
export const sessionCookieOptions = (
  auth: SessionCookieConfig,
): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: isPublishedOverTls(auth.baseUrl),
  path: sessionCookiePath(auth.webAppUrl),
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
  auth: SessionCookieConfig,
  tokens: SessionTokens,
): void => {
  const cookie = sessionCookieOptions(auth);
  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...cookie,
    maxAge: tokens.expiresIn * 1000,
  });
  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...cookie,
    maxAge: REFRESH_TOKEN_COOKIE_MS,
  });
};

/** Both session cookies gone: signed out, or a session the API ended. */
export const clearSessionCookies = (
  response: Response,
  auth: SessionCookieConfig,
): void => {
  const cookie = sessionCookieOptions(auth);
  response.clearCookie(ACCESS_TOKEN_COOKIE, cookie);
  response.clearCookie(REFRESH_TOKEN_COOKIE, cookie);
};
