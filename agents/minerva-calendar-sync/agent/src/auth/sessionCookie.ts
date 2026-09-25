import { isPublishedOverTls, sessionCookiePath } from "@ncfritz/olympus-nest";
import type { CookieOptions } from "express";

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
