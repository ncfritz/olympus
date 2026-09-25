import { publishedUrl } from "@ncfritz/olympus-nest";
import type { CookieOptions } from "express";

/** The cookie the site's refresh token lives in. */
export const REFRESH_COOKIE = "olympus_refresh";

/**
 * Where the browser sends the refresh cookie.
 *
 * The API is published under a path (`/api`), so the cookie's path has to
 * include it or the browser never sends the cookie to the endpoint that
 * needs it. Scoped to the auth path rather than `/`, so it reaches `/token`
 * and `/logout` and nothing else.
 */
export const refreshCookiePath = (publicBaseUrl: string | undefined): string =>
  publicBaseUrl === undefined
    ? "/v1/auth"
    : publishedUrl(publicBaseUrl, "/v1/auth").pathname;

/**
 * The attributes the refresh cookie is set *and* cleared with.
 *
 * One definition for both, because a browser only replaces a cookie when
 * the name, domain and path all match: clearing it with a different path
 * leaves the original in place, and the site then keeps presenting a
 * revoked token on every visit. Setting and clearing in two places is
 * exactly how those drift apart.
 */
export const refreshCookieOptions = (
  publicBaseUrl: string | undefined,
): CookieOptions => ({
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: refreshCookiePath(publicBaseUrl),
});
