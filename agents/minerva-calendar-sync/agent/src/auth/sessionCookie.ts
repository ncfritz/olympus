import type { CookieOptions } from "express";

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
 * The options every session cookie is set *and cleared* with: a cookie is
 * only replaced by one with the same name, path and domain, so the two
 * have to agree.
 */
export const sessionCookieOptions = (
  webAppUrl: string | undefined,
  secure: boolean,
): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure,
  path: sessionCookiePath(webAppUrl),
});
