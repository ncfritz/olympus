import {
  authorizeUrl,
  createPkce,
  exchangeCodeForCookie,
  type IssuedAccess,
  parseRedirect,
} from "@ncfritz/olympus-auth-flow";
import { browserCrypto } from "./browserCrypto";
import {
  type Callback,
  checkCallback,
  isCallbackReady,
  PENDING_KEY,
  readPending,
  returnableTo,
} from "./pending";
import { CLIENT_ID, tokenEndpoint } from "./tokenEndpoint";

const pkce = createPkce(browserCrypto);

/** Where the API sends the browser back, and what the client registered. */
export const redirectUri = (): string =>
  `${window.location.origin}/auth/callback`;

/**
 * Starts a sign-in: leaves the verifier and state in this tab, then hands the
 * browser to the API, which hands it to the provider.
 *
 * A full navigation rather than a popup or an iframe. The provider decides what
 * authenticating looks like -- a password, a passkey, a second factor -- and
 * that is a page of theirs, in the address bar, where the person can see whose
 * it is.
 */
export const startSignIn = async (
  apiBaseUrl: string,
  provider: string,
  returnTo = returnableTo(window.location.pathname + window.location.search),
): Promise<void> => {
  const verifier = await pkce.newVerifier();
  const state = await pkce.newState();
  sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ verifier, state, returnTo }),
  );
  window.location.assign(
    authorizeUrl(apiBaseUrl, {
      clientId: CLIENT_ID,
      redirectUri: redirectUri(),
      challenge: await pkce.challengeFor(verifier),
      state,
      provider,
    }),
  );
};

export type Completion =
  { tokens: IssuedAccess; returnTo: string } | { problem: string };

/**
 * Finishes a sign-in on the callback page: checks what came back, exchanges the
 * code, and forgets the pending request either way -- a verifier is good for one
 * attempt, and leaving it behind for a second is the thing PKCE exists to stop.
 */
export const completeSignIn = async (
  apiBaseUrl: string,
  search: string = window.location.search,
): Promise<Completion> => {
  const pending = readPending(sessionStorage.getItem(PENDING_KEY));
  sessionStorage.removeItem(PENDING_KEY);

  const checked: Callback = checkCallback(
    parseRedirect(`?${search.replace(/^\?/, "")}`),
    pending,
  );
  if (!isCallbackReady(checked)) return { problem: checked.problem };

  const tokens = await exchangeCodeForCookie(tokenEndpoint(apiBaseUrl), {
    code: checked.code,
    redirectUri: redirectUri(),
    clientId: CLIENT_ID,
    verifier: checked.verifier,
    // What the session list will call this browser. `userAgent` is what there
    // is; the alternative is asking, and nobody wants to be asked.
    deviceName: navigator.userAgent.slice(0, 120),
  });
  return { tokens, returnTo: checked.returnTo };
};

/**
 * Wraps a completion so it happens once per document, whatever React does with
 * the callback page.
 *
 * `completeSignIn` consumes a one-shot value: it takes the pending request out
 * of `sessionStorage` before it does anything else, because a verifier left
 * behind for a second attempt is the thing PKCE exists to stop. A second call
 * therefore finds nothing and reports a callback belonging to no sign-in --
 * which in practice was not a hostile callback but the callback page's own
 * effect running again when the router object changed, with the second run's
 * verdict being the one the person saw and the first run's success discarded.
 *
 * Memoising the in-flight completion makes a later caller await the first
 * one's result, as session.ts's `rotating` does for concurrent refreshes.
 * Unlike that one it is never cleared: a completion is once per document, and a
 * fresh attempt arrives as a fresh document -- both the API's redirect back and
 * "Start again" are full navigations, not client-side ones.
 */
export const createCompleter = (
  complete: () => Promise<Completion>,
): (() => Promise<Completion>) => {
  let completing: Promise<Completion> | undefined;
  return () => (completing ??= complete());
};
