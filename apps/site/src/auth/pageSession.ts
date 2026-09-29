import { refreshFromCookie } from "@ncfritz/olympus-auth-flow";
import { API_BASE_URL, attachSession } from "./interceptors";
import { createSession, type Session } from "./session";
import { completeSignIn, createCompleter } from "./signIn";
import { CLIENT_ID, tokenEndpoint } from "./tokenEndpoint";

/**
 * The page's session: one, for the life of the document.
 *
 * At module scope on purpose. The SDK's clients are module singletons, so the
 * interceptors that read this are installed once -- and a session rebuilt by a
 * re-render would leave them holding the old one. It lives here rather than
 * beside the React provider because the socket handshake and the callback page
 * need it too, and neither is inside a component tree.
 */
export const pageSession: Session = createSession({
  refresh: () =>
    refreshFromCookie(tokenEndpoint(API_BASE_URL), { clientId: CLIENT_ID }),
});

attachSession(pageSession);

/**
 * The callback page's one completion, at module scope for the same reason the
 * session is: it survives the re-renders and effect re-runs of the page that
 * calls it, and the authorization code it spends can only be spent once.
 */
export const completeOnce = createCompleter(() => completeSignIn(API_BASE_URL));
