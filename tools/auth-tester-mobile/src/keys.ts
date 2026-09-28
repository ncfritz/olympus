/**
 * Keychain keys, derived from the API a token belongs to.
 *
 * Its own module, with no import in it, because this is the part that is
 * tested: anything reaching `expo-secure-store` reaches React Native, whose
 * sources are Flow-typed and cannot be parsed by the test runner at all. A
 * module boundary is the only honest way to keep a unit test unit-sized here.
 */

/**
 * SecureStore keys may hold alphanumerics, `.`, `-` and `_`, and a base URL
 * holds none of the punctuation that matters to it, so this is a mapping
 * rather than a hash: a key you can read in a debugger is worth more here than
 * one that is shorter. A run of punctuation collapses to one dash, so
 * `https://` does not become `https---`.
 */
export const slug = (value: string): string =>
  value.replace(/[^A-Za-z0-9.\-_]+/g, "-");

export const tokensKey = (baseUrl: string): string => `tokens.${slug(baseUrl)}`;

/**
 * Written without `requireAuthentication`, beside the tokens that need it.
 *
 * `getItemAsync` resolves **null** when Face ID is declined, and null again
 * when there is nothing stored, and an app that cannot tell those apart shows
 * "not signed in" to someone who simply cancelled a prompt -- then signs them
 * in again, issuing a second session for no reason. The marker is how the two
 * are told apart; it holds no secret.
 */
export const presenceKey = (baseUrl: string): string =>
  `${tokensKey(baseUrl)}.present`;

/** The settings the screen remembers between launches. No secret in it either. */
export const SETTINGS_KEY = "settings";
