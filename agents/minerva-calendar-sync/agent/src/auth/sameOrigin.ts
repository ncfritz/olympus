import type { Request } from "express";
import type { SessionCookieConfig } from "./sessionCookie";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Whether a request that rides on the session cookies may change
 * something: it is a safe method, or it comes from the console itself.
 *
 * SameSite=Lax keeps the cookies off another site's requests, but not off
 * another origin's on the same site, and every host under ncfritz.net is
 * one site. A form there can POST here without a preflight, cookies and
 * all; the browser names its origin when it does (ADR 0029). A request
 * with neither Origin nor Sec-Fetch-Site is not a browser's, and has no
 * cookie a browser would have sent for it.
 */
export const mayChangeWithCookies = (
  req: Pick<Request, "method" | "headers">,
  auth: SessionCookieConfig,
): boolean => {
  if (SAFE_METHODS.has(req.method)) return true;
  const origin = req.headers.origin;
  if (origin !== undefined) {
    return consoleOrigins(auth).has(origin);
  }
  const site = req.headers["sec-fetch-site"];
  return site === undefined || site === "same-origin" || site === "none";
};

/** Where the console and its agent are served from. */
const consoleOrigins = (auth: SessionCookieConfig): Set<string> => {
  const origins = new Set<string>();
  for (const url of [auth.baseUrl, auth.webAppUrl]) {
    if (!url) continue;
    try {
      origins.add(new URL(url).origin);
    } catch {
      // Not a URL: configuration would have said.
    }
  }
  return origins;
};
