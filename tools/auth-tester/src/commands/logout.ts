import { apiCall } from "../output";
import type { Tester } from "../tester";

/**
 * Ends the session these tokens belong to.
 *
 * Signing out twice is not an error, and `signedOut: false` means the session
 * had already gone -- which is the answer a client retrying a sign-out wants.
 */
export const logout = async (tester: Tester): Promise<void> => {
  tester.tokens();
  const result = await apiCall("signing out", () => tester.auth.signOut());
  tester.store.clear();
  console.log(
    result.signedOut
      ? "Signed out; the session is revoked and the stored tokens are gone."
      : "That session had already ended; the stored tokens are gone.",
  );
  console.log(
    "An access token issued from it stays valid until it expires, within ten minutes: authenticating a request does not read the database (ADR 0018).",
  );
};
