import { createHash, timingSafeEqual } from "crypto";

/**
 * PKCE (RFC 7636). Every client here is public, so the code verifier is
 * what ties the token request to whoever started the sign-in: an
 * authorization code stolen in transit is useless without it.
 *
 * Only S256. The spec also allows `plain`, where the challenge *is* the
 * verifier — which protects nothing if the authorization request can be
 * observed, and the request travels through a browser redirect.
 */
export const CODE_CHALLENGE_METHOD = "S256";

const base64url = (value: Buffer): string => value.toString("base64url");

/** What a client sends as `code_challenge` for a given verifier. */
export const codeChallengeFor = (verifier: string): string =>
  base64url(createHash("sha256").update(verifier, "ascii").digest());

/** RFC 7636: 43 to 128 characters from an unreserved set. */
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;

export const isWellFormedVerifier = (verifier: string): boolean =>
  VERIFIER.test(verifier);

/**
 * Whether this verifier produced that challenge.
 *
 * Compared in constant time. The challenge is not a secret, so this is
 * belt-and-braces rather than load-bearing — but a comparison that leaks
 * where two values first differ is a bad habit to keep in an auth path.
 */
export const verifierMatches = (
  verifier: string,
  challenge: string,
): boolean => {
  if (!isWellFormedVerifier(verifier)) return false;
  const expected = Buffer.from(codeChallengeFor(verifier));
  const actual = Buffer.from(challenge);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
