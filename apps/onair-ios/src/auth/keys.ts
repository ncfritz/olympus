/*
 * Keychain keys, by the API a token belongs to: switching the base URL (a dev
 * API, say) never hands one API another's tokens. Pure, like the tester's
 * `keys.ts`, which this follows.
 */

/** SecureStore keys may hold alphanumerics, `.`, `-` and `_`. */
export const slug = (value: string): string =>
  value.replace(/[^A-Za-z0-9.\-_]+/g, "-");

export const tokensKey = (baseUrl: string): string => `tokens.${slug(baseUrl)}`;
