import { TesterError } from "../errors";
import { apiCall, printSessions } from "../output";
import type { Tester } from "../tester";

/** Every device this user is signed in on; the caller's own is starred. */
export const sessions = async (tester: Tester): Promise<void> => {
  tester.tokens();
  const listed = await apiCall("listing sessions", () =>
    tester.auth.listSessions(),
  );
  printSessions(listed);
};

/**
 * Ends one session. Revoking the caller's own is allowed and is not the same
 * as signing out: the refresh token dies, the access token lives out its ten
 * minutes, and the cookie -- which a CLI does not have -- is not cleared.
 */
export const revoke = async (
  tester: Tester,
  sessionId: string | undefined,
): Promise<void> => {
  if (sessionId === undefined) {
    throw new TesterError("a session id is required: see `sessions`");
  }
  tester.tokens();
  const result = await apiCall(`revoking ${sessionId}`, () =>
    tester.auth.revokeSession(sessionId),
  );
  console.log(`Revoked ${result.sessionId}.`);
  if (result.signedOutThisDevice) {
    // The refresh token in the file is dead, so keeping it would only produce
    // a confusing failure at the next command.
    tester.store.clear();
    console.log(
      "That was this session, so the stored tokens are gone. The access token would still have been accepted for its remaining minutes: revoking takes effect at the next refresh, not at once (ADR 0018).",
    );
  }
};
