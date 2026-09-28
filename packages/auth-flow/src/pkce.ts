/**
 * What PKCE needs from the platform: randomness and SHA-256, both as
 * base64url, and both allowed to be asynchronous because
 * `expo-crypto`'s digest is (Node's is not, and wrapping a synchronous
 * answer in a promise costs nothing).
 */
export type FlowCrypto = {
  randomBase64Url(bytes: number): string | Promise<string>;
  sha256Base64Url(text: string): string | Promise<string>;
};

/** The only challenge method the API accepts, and the only one worth having. */
export const CODE_CHALLENGE_METHOD = "S256";

export type Pkce = {
  newVerifier(): Promise<string>;
  challengeFor(verifier: string): Promise<string>;
  newState(): Promise<string>;
};

/**
 * The verifier is the secret that makes a public client safe: the
 * authorization code travels through a browser and a redirect anything on the
 * device could have claimed, and it is useless without the verifier, which
 * never leaves the client.
 *
 * 32 random bytes as base64url is 43 characters, which is RFC 7636 §4.1's
 * minimum and entirely enough.
 */
export const createPkce = (crypto: FlowCrypto): Pkce => ({
  newVerifier: async () => crypto.randomBase64Url(32),
  challengeFor: async (verifier) => crypto.sha256Base64Url(verifier),
  // The client's own check that the callback belongs to the sign-in it
  // started (RFC 6749 §10.12). The API returns it untouched.
  newState: async () => crypto.randomBase64Url(16),
});
