/**
 * Only ever allows a redirect back to the configured web app's own origin —
 * an unvalidated returnTo would be an open redirect. No cookie/token value
 * is ever exposed in the URL, so the risk is confined to redirecting a user
 * who just authenticated to an attacker's page, not credential leakage.
 */
export function sanitizeReturnTo(returnTo: string | undefined, webAppUrl: string | undefined): string | undefined {
  if (!returnTo || !webAppUrl) return undefined;

  try {
    const target = new URL(returnTo, webAppUrl);
    const allowed = new URL(webAppUrl);
    return target.origin === allowed.origin ? target.href : undefined;
  } catch {
    return undefined;
  }
}
