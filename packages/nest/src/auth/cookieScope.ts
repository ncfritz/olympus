// Where a cookie is scoped, and whether it is `Secure`. Both of these were
// worked out the hard way in Minerva's agent; the API needs them too.

/**
 * How a console's cookies are scoped. On the control host (ADR 0021)
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
export const isPublishedOverTls = (baseUrl: string): boolean => {
  try {
    return new URL(baseUrl).protocol === "https:";
  } catch {
    return false;
  }
};
