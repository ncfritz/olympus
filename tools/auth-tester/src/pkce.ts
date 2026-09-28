import { createHash, randomBytes } from "crypto";

/** The only method the API accepts, and the only one worth having. */
export const CODE_CHALLENGE_METHOD = "S256";

/**
 * A PKCE code verifier: RFC 7636 §4.1 wants 43 to 128 characters from the
 * unreserved set, and 32 random bytes as base64url is exactly 43 of them.
 *
 * This is the secret that makes a public client safe: the authorization code
 * travels through a browser and a loopback listener that anything on the
 * machine could have bound, and it is useless without the verifier, which
 * never leaves this process.
 */
export const newVerifier = (): string => randomBytes(32).toString("base64url");

/** The challenge sent with the authorization request: base64url(SHA-256(verifier)). */
export const challengeFor = (verifier: string): string =>
  createHash("sha256").update(verifier).digest("base64url");

/**
 * The `state`: this client's own check that the callback it is handed belongs
 * to the sign-in it started (RFC 6749 §10.12). The API returns it untouched.
 */
export const newState = (): string => randomBytes(16).toString("base64url");
