/**
 * The identity providers this site offers.
 *
 * A list here rather than from the API: which providers exist is the API's
 * configuration (`AUTH_OIDC_PROVIDERS_FILE`), and it does not publish them --
 * deliberately, since an unauthenticated list of a deployment's identity
 * providers is information nobody needs. Adding one is a line here and an entry
 * there.
 *
 * `id` is the `provider` the authorize endpoint takes, and has to match the
 * `name` in that file exactly.
 */
export type Provider = { id: string; label: string };

export const PROVIDERS: Provider[] = [{ id: "google", label: "Google" }];
