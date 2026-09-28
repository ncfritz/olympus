import type { IssuedTokens } from "./oauth";

export type SavedTokens = {
  /** The API these were issued by: sending them to another one is a mistake. */
  apiBaseUrl: string;
  clientId: string;
  provider: string;
  accessToken: string;
  /** Milliseconds since the epoch, from `expires_in` when it was issued. */
  accessTokenExpiresAt: number;
  refreshToken: string;
  /**
   * The refresh token the last rotation replaced, kept for one reason:
   * `refresh --replay` presents it again to prove reuse detection ends the
   * session. Nothing else reads it, and a client that is not testing the
   * API should not keep one.
   */
  previousRefreshToken?: string;
  /** The `sid` of the session these belong to, for the session list. */
  sessionId?: string;
  savedAt: string;
};

/**
 * The saved tokens after an exchange or a rotation. The token being replaced
 * becomes `previousRefreshToken`, which is what `refresh --replay` presents.
 */
export const afterIssue = (
  was: Omit<
    SavedTokens,
    "accessToken" | "accessTokenExpiresAt" | "refreshToken" | "savedAt"
  > &
    Partial<Pick<SavedTokens, "refreshToken">>,
  issued: IssuedTokens,
  now = Date.now(),
): SavedTokens => ({
  ...was,
  accessToken: issued.accessToken,
  accessTokenExpiresAt: now + issued.expiresIn * 1000,
  refreshToken: issued.refreshToken,
  ...(was.refreshToken === undefined
    ? {}
    : { previousRefreshToken: was.refreshToken }),
  savedAt: new Date(now).toISOString(),
});

/** Whether the access token is spent, with a margin for the call itself. */
export const expired = (saved: SavedTokens, now = Date.now()): boolean =>
  saved.accessTokenExpiresAt - 30_000 <= now;
