import { createHash, randomBytes } from "crypto";

/**
 * The pieces of a provider sign-in the API starts for a user (ADR 0028):
 * a random state, kept only as its hash, and a PKCE verifier with its
 * S256 challenge. No I/O.
 */
export type SignInSecrets = {
  state: string;
  stateHash: string;
  codeVerifier: string;
  codeChallenge: string;
};

const base64url = (bytes: Buffer): string => bytes.toString("base64url");

export const hashState = (state: string): string =>
  createHash("sha256").update(state).digest("hex");

export const newSignInSecrets = (): SignInSecrets => {
  const state = base64url(randomBytes(32));
  const codeVerifier = base64url(randomBytes(32));
  return {
    state,
    stateHash: hashState(state),
    codeVerifier,
    codeChallenge: base64url(
      createHash("sha256").update(codeVerifier).digest(),
    ),
  };
};

/** How long a started sign-in may take before its callback is refused. */
export const SIGN_IN_LIFETIME_MS = 10 * 60 * 1000;

/**
 * The API's callback for a provider: under the public base URL, which
 * includes any path the API is published under. Registered with Google and
 * Microsoft, so it must be exactly this.
 */
export const callbackUrlFor = (
  publicBaseUrl: string,
  provider: string,
): string =>
  `${publicBaseUrl.replace(/\/+$/, "")}/v1/minerva/calendar-accounts/callback/${provider}`;

/**
 * Whether `returnTo` is a page of one of the API's clients: an absolute
 * URL whose origin is one of AUTH_CLIENT_ORIGINS. Anything else would make
 * the callback an open redirect.
 */
export const isClientPage = (
  returnTo: unknown,
  clientOrigins: string[],
): returnTo is string => {
  if (typeof returnTo !== "string") return false;
  try {
    const url = new URL(returnTo);
    return clientOrigins.some(
      (origin) => new URL(origin).origin === url.origin,
    );
  } catch {
    return false;
  }
};

/** `returnTo` with the outcome of the sign-in in its query. */
export const withOutcome = (
  returnTo: string,
  outcome: Record<string, string>,
): string => {
  const url = new URL(returnTo);
  for (const [key, value] of Object.entries(outcome)) {
    url.searchParams.set(key, value);
  }
  return url.href;
};

/** Who an account belongs to now, and who may claim it by signing in. */
export type LinkFacts = {
  /** The user who started the sign-in. */
  userId: string;
  /** The account's owner, when it has one. */
  ownerId?: string;
  /** The user who signs in to Olympus with this account, when one does. */
  identityOwnerId?: string;
};

/**
 * Whether a sign-in links the account to the user who started it
 * (ADR 0028): not when it is already another user's, nor when it is the
 * account another user signs in to Olympus with.
 */
export const decideLink = (
  facts: LinkFacts,
): { link: true; alreadyTheirs: boolean } | { link: false; reason: string } => {
  if (facts.ownerId !== undefined && facts.ownerId !== facts.userId) {
    return { link: false, reason: "the account is another user's" };
  }
  if (
    facts.identityOwnerId !== undefined &&
    facts.identityOwnerId !== facts.userId
  ) {
    return {
      link: false,
      reason: "the account is another user's sign-in identity",
    };
  }
  return { link: true, alreadyTheirs: facts.ownerId === facts.userId };
};
