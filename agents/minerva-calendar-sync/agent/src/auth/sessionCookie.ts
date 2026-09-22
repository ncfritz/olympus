import type { CookieOptions } from "express";

/** What the cookies are scoped and secured by: where this agent and its console are published. */
export interface SessionCookieConfig {
  /** AUTH_BASE_URL: where the browser reaches this agent. */
  baseUrl: string;
  /** WEB_APP_URL: where the browser reaches its console. */
  webAppUrl?: string;
}

/**
 * How this console's cookies are scoped. On the control host (ADR 0021)
 * every console in the suite shares one origin, so a cookie left at the
 * default path would be sent to all of them; WEB_APP_URL carries this
 * console's own path, and the cookies go no further.
 *
 * The agent is published under the console's path
 * (`/minerva/calendar/api`), so its own requests still carry them. A web
 * app with a name to itself gets `/`, as before.
 */
export const sessionCookiePath = (webAppUrl: string | undefined): string => {
  if (!webAppUrl) return "/";
  try {
    const path = new URL(webAppUrl).pathname.replace(/\/+$/, "");
    return path === "" ? "/" : path;
  } catch {
    return "/";
  }
};

/**
 * Whether the browser reaches this agent over TLS, which is what decides
 * `Secure`. It is read from the URL the agent is published at rather than
 * from the request, because TLS is terminated at nginx: the request that
 * arrives here is plain HTTP, and `req.secure` would say so unless the
 * proxy is trusted — which is how the session cookie came to be issued
 * without `Secure` at all.
 */
const isPublishedOverTls = (baseUrl: string): boolean => {
  try {
    return new URL(baseUrl).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * The options every session cookie is set *and cleared* with: a cookie is
 * only replaced by one with the same name, path and domain, so the two
 * have to agree.
 */
export const sessionCookieOptions = (
  auth: SessionCookieConfig,
): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: isPublishedOverTls(auth.baseUrl),
  path: sessionCookiePath(auth.webAppUrl),
});
