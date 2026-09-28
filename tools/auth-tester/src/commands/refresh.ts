import {
  afterIssue,
  checkReuseDetection,
  decodeToken,
  type FormAnswer,
  oauthError,
  refreshTokens,
} from "@ncfritz/olympus-auth-flow";
import { describeToken } from "../claims";
import { TesterError } from "../errors";
import type { Tester } from "../tester";

/** Rotates the refresh token: the new one replaces the one presented. */
export const refresh = async (tester: Tester): Promise<void> => {
  const saved = tester.tokens();
  const issued = await refreshTokens(tester.post, {
    clientId: saved.clientId,
    refreshToken: saved.refreshToken,
  });
  tester.store.save(afterIssue(saved, issued));

  console.log(
    "Rotated. The token presented is now the previous one, and dead.",
  );
  console.log(describeToken(decodeToken(issued.accessToken)).join("\n"));
  console.log(
    "`sid` and `auth_time` are unchanged: rotating a token does not start a session, which is what keeps the session list stable and what makes a recent-sign-in requirement mean signing in again.",
  );
};

/**
 * Presents the refresh token that the last rotation replaced.
 *
 * This is reuse detection, and it is the one flow whose success looks like a
 * failure: the API answers `invalid_grant` **and revokes the session**, so the
 * token that was working stops working too. Two clients refreshing at once
 * look exactly like a stolen token, and ADR 0018 chose to end the session
 * rather than to guess.
 *
 * So both requests are made: the replay, then the live token. The second is
 * what tells a refusal apart from a revocation -- a refusal alone would be
 * satisfied by an API that simply did not recognise the old token.
 */
/** How an answer reads in a line: the OAuth error if there is one. */
const answered = (answer: FormAnswer): string =>
  `${answer.status} ${oauthError(answer)?.error ?? JSON.stringify(answer.body)}`;

export const replay = async (tester: Tester): Promise<void> => {
  const saved = tester.tokens();
  const previous = saved.previousRefreshToken;
  if (previous === undefined) {
    throw new TesterError(
      "there is no previous refresh token to replay: run refresh once first",
    );
  }

  const checked = await checkReuseDetection(tester.post, {
    clientId: saved.clientId,
    previousRefreshToken: previous,
    refreshToken: saved.refreshToken,
  });

  if (checked.verdict === "accepted") {
    console.log(
      "The API ISSUED TOKENS for a refresh token that had already been rotated. Reuse detection is not working.",
    );
    throw new TesterError("a rotated refresh token was accepted");
  }
  console.log(`The replay was refused: ${answered(checked.replayed)}`);

  if (checked.verdict === "refused-only") {
    console.log(
      "The live refresh token still works, so the session was NOT revoked: the replay was only refused.",
    );
    throw new TesterError(
      "a replayed token was refused without the session being revoked",
    );
  }
  console.log(
    `The live token is refused too: ${answered(checked.live)}. The session is revoked, which is reuse detection working.`,
  );

  tester.store.clear();
  console.log(
    `Both tokens are dead; ${tester.store.location} removed. Run login.`,
  );
};
