/**
 * A URL under AUTH_BASE_URL, which carries the path this agent is
 * published at: `https://control…/minerva/calendar/api` on the control
 * host (ADR 0021), or the root of its own name in the workspace.
 *
 * `new URL("/auth/callback/google", base)` throws that path away — a
 * reference beginning with "/" is absolute against the origin — which
 * sends the provider's redirect to a path nothing serves. The agent's
 * routes are relative to where it is published, not to the host.
 */
export const publishedUrl = (baseUrl: string, path: string): URL =>
  new URL(
    path.replace(/^\/+/, ""),
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  );
