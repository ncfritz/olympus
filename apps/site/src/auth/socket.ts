import type { Session } from "./session";

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
 *
 * It answers synchronously when the page already holds a token that has not
 * expired, which is the ordinary case: the header that opens this socket only
 * renders once somebody is signed in. That matters because the handshake is not
 * cancellable. `socket.io-react-hook` forgets a connection when the component
 * that asked for it unmounts, but leaves its own `connect`, `connect_error` and
 * `disconnect` handlers attached, and those look the forgotten connection up by
 * key -- so an attempt still in flight across an unmount ends in
 * `Cannot read properties of undefined (reading 'subscribers')` from inside the
 * provider. Awaiting a rotation before answering held the handshake open across
 * exactly that window. This does not fix the library; it stops standing in the
 * one place where it breaks.
 */
export const createSocketAuth = (
  session: Session,
  now: () => number = () => Date.now(),
): ((cb: (data: object) => void) => void) => {
  const present = (token: string | undefined) =>
    token === undefined ? {} : { token };

  return (cb) => {
    const held = session.held();
    // No margin, deliberately: a token with seconds left still completes a
    // handshake, and the next reconnect asks again. The margin exists to stop
    // an HTTP call being sent with a token that expires in flight; here the
    // cost of waiting is the crash above.
    if (held !== undefined && held.expiresAt > now()) {
      cb(present(held.accessToken));
      return;
    }
    session
      .token()
      .then((token) => {
        cb(present(token));
      })
      .catch(() => {
        // The callback has to be called: Socket.IO waits for it, and a
        // connection attempt that never reports back never fails either. With
        // no token the API refuses the socket, which is the honest outcome.
        cb({});
      });
  };
};
