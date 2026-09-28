import { pageSession } from "./pageSession";

/**
 * The access token, for the Socket.IO handshake.
 *
 * In `auth` rather than a header: a WebSocket upgrade carries no
 * `Authorization` the browser will set, and a token in the query string ends up
 * in every access log between here and the API.
 *
 * A function, not an object, because Socket.IO calls it on every connection
 * attempt -- so a reconnect after an access token has expired presents a fresh
 * one rather than the one the tab started with.
 */
export const socketAuth = (cb: (data: object) => void): void => {
  pageSession
    .token()
    .then((token) => {
      cb(token === undefined ? {} : { token });
    })
    .catch(() => {
      // The callback has to be called: Socket.IO waits for it, and a connection
      // attempt that never reports back never fails either. With no token the
      // API refuses the socket, which is the honest outcome.
      cb({});
    });
};

/**
 * Stable, so the hook that takes it does not see new options on every render.
 */
export const SOCKET_OPTIONS = { auth: socketAuth };
