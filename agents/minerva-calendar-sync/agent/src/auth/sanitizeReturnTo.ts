/**
 * Only ever allows a redirect back into the configured web app — an
 * unvalidated returnTo would be an open redirect. No cookie/token value
 * is ever exposed in the URL, so the risk is confined to redirecting a
 * user who just authenticated to an attacker's page, not credential
 * leakage.
 *
 * The origin is not enough on the control host (ADR 0021), where every
 * console in the suite shares one: WEB_APP_URL carries this console's
 * path (`https://control…/minerva/calendar`), and a returnTo has to be
 * under it. A web app published at the root of its own name allows its
 * whole origin, as before.
 */
export function sanitizeReturnTo(
  returnTo: string | undefined,
  webAppUrl: string | undefined,
): string | undefined {
  if (!returnTo || !webAppUrl) return undefined;

  try {
    const allowed = new URL(webAppUrl);
    const target = new URL(returnTo, webAppUrl);
    if (target.origin !== allowed.origin) return undefined;
    if (!isUnder(target.pathname, allowed.pathname)) return undefined;
    return target.href;
  } catch {
    return undefined;
  }
}

/**
 * Whether a path is the web app's own root or below it. Compared by
 * segment, so /minerva/calendar does not vouch for /minerva/calendars.
 */
const isUnder = (path: string, base: string): boolean => {
  const root = base.replace(/\/+$/, "");
  return root === "" || path === root || path.startsWith(`${root}/`);
};
