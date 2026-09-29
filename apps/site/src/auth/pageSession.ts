import { refreshFromCookie } from "@ncfritz/olympus-auth-flow";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL, attachSession } from "./interceptors";
import { createSession, type Session } from "./session";
import { NOTIFICATIONS_NAMESPACE } from "./notifications";
import { createSocketAuth } from "./socket";
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

/**
 * The Socket.IO handshake's options, built once. A new object on every render
 * would read as new options to the hook that takes them, and reconnect.
 */
export const SOCKET_OPTIONS = { auth: createSocketAuth(pageSession) };

let notifications: Socket | undefined;

/**
 * The notifications connection: one per document, opened the first time
 * something asks for it.
 *
 * One per document rather than one per component, which is the mistake the
 * replaced dependency encoded. Tying a socket's lifetime to a header that
 * mounts and unmounts while the session settles means connecting and tearing
 * down mid-handshake, and a handshake cannot be cancelled. This one outlives
 * every render, and Socket.IO's own reconnection is left to do its job.
 */
export const notificationsSocket = (): Socket =>
  (notifications ??= io(NOTIFICATIONS_NAMESPACE, SOCKET_OPTIONS));

/**
 * Closes it, for a sign-out. A sign-in later in the same document opens a new
 * one, with a token of its own.
 */
export const closeNotificationsSocket = (): void => {
  notifications?.disconnect();
  notifications = undefined;
};
