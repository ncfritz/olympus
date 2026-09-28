import {
  afterIssue,
  expired,
  type IssuedTokens,
  type SavedTokens,
} from "@ncfritz/olympus-auth-flow";

/**
 * The tokens in force, in memory, with the Keychain written through.
 *
 * In memory because the Keychain read can prompt for Face ID, and a token
 * provider that prompts per request would make one API call feel like an
 * interrogation. It is read once -- at launch, or when a sign-in produces
 * one -- and everything after that works from here.
 *
 * Nothing platform-specific is imported: persisting and refreshing are the
 * caller's, which is what lets this be tested.
 */
export type Session = {
  /** What is held now, without touching the Keychain. */
  current(): SavedTokens | undefined;
  /** After a sign-in, or a sign-out with `undefined`. */
  hold(tokens: SavedTokens | undefined): void;
  /**
   * The `auth` provider for the Olympus clients: the access token, rotated
   * first if it has expired. Undefined when nobody is signed in, so a call
   * with no token is the same code path as one with it.
   */
  accessToken(): Promise<string | undefined>;
};

export const createSession = (options: {
  /** Rotates, given the refresh token: the API's refresh grant. */
  refresh: (refreshToken: string) => Promise<IssuedTokens>;
  /** Writes the rotation to the Keychain. Failures are the caller's business. */
  persist: (tokens: SavedTokens) => Promise<void>;
  /** Told whenever the held tokens change, so a screen can follow. */
  onChange?: (tokens: SavedTokens | undefined) => void;
  /** Send the stored token even when it has expired: for seeing a 401. */
  stale?: boolean;
  now?: () => number;
}): Session => {
  let held: SavedTokens | undefined;
  // One rotation at a time. Two requests either side of an expiry would
  // otherwise each refresh, and the second would present a token the first
  // had already rotated away -- which the API reads as a stolen token and
  // answers by ending the session (ADR 0018).
  let rotating: Promise<string | undefined> | undefined;

  const hold = (tokens: SavedTokens | undefined) => {
    held = tokens;
    options.onChange?.(tokens);
  };

  const rotate = async (tokens: SavedTokens): Promise<string | undefined> => {
    const issued = await options.refresh(tokens.refreshToken);
    const next = afterIssue(tokens, issued, options.now?.());
    hold(next);
    await options.persist(next);
    return next.accessToken;
  };

  return {
    current: () => held,
    hold,
    accessToken: async () => {
      const tokens = held;
      if (tokens === undefined) return undefined;
      if (options.stale === true || !expired(tokens, options.now?.())) {
        return tokens.accessToken;
      }
      rotating ??= rotate(tokens).finally(() => {
        rotating = undefined;
      });
      return rotating;
    },
  };
};
