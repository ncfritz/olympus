import { decodeToken } from "@ncfritz/olympus-auth-flow";
import { describeToken } from "../claims";
import { apiCall, printUser } from "../output";
import type { Tester } from "../tester";

/**
 * Who the API says the caller is, and what the token it was shown claims.
 *
 * Both, because they can disagree and the difference is the design: `roles`
 * in the token is a ten-minute-old snapshot, while the endpoint reads the
 * directory now. A role granted a minute ago shows up below in one place and
 * not the other.
 */
export const whoami = async (tester: Tester): Promise<void> => {
  const saved = tester.tokens();
  console.log(
    `${saved.apiBaseUrl}, signed in with ${saved.provider} at ${saved.savedAt}`,
  );

  // First, because the call is what may rotate the token: the claims printed
  // afterwards are then the ones that were actually presented.
  const user = await apiCall("describing the signed-in user", () =>
    tester.auth.describeCurrentUser(),
  );
  printUser(user);

  console.log("The access token says:");
  console.log(
    describeToken(decodeToken(tester.tokens().accessToken)).join("\n"),
  );
};
