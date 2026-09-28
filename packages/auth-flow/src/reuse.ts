import { attemptRefresh, type FormAnswer, type FormPost } from "./oauth";

export type ReuseDetection = {
  /** What presenting the already-rotated token got. */
  replayed: FormAnswer;
  /** What presenting the live one got, immediately afterwards. */
  live: FormAnswer;
  verdict: ReuseVerdict;
};

export type ReuseVerdict =
  /**
   * Both refused: the replay was rejected *and* the session was ended, which
   * is reuse detection doing its job (ADR 0018).
   */
  | "revoked"
  /** The rotated token was accepted. Reuse detection is not working. */
  | "accepted"
  /**
   * The replay was refused and the live token still works, so the session was
   * not ended. A refusal is not detection: an API that had merely forgotten
   * the old token would look exactly like this.
   */
  | "refused-only";

/**
 * Presents a refresh token that has already been rotated away, and then the
 * live one.
 *
 * Both requests, always, because the second is the whole point. A rotated
 * token being refused proves nothing on its own; what ADR 0018 promises is
 * that the *session* ends, and the only way to see that is to find the live
 * token refused too.
 *
 * The cost of that promise is real and worth remembering while reading the
 * verdict: two clients refreshing at once look exactly like a stolen token, so
 * they get the same answer. This procedure is that race, run on purpose.
 */
export const checkReuseDetection = async (
  post: FormPost,
  request: {
    clientId: string;
    /** The token the last rotation replaced. */
    previousRefreshToken: string;
    /** The one that replaced it, and should die with the session. */
    refreshToken: string;
  },
): Promise<ReuseDetection> => {
  const replayed = await attemptRefresh(post, {
    clientId: request.clientId,
    refreshToken: request.previousRefreshToken,
  });
  if (replayed.status === 200) {
    // No second request: the session is in whatever state accepting a rotated
    // token left it, and asking again would only muddy what happened.
    return { replayed, live: replayed, verdict: "accepted" };
  }

  const live = await attemptRefresh(post, {
    clientId: request.clientId,
    refreshToken: request.refreshToken,
  });
  return {
    replayed,
    live,
    verdict: live.status === 200 ? "refused-only" : "revoked",
  };
};
