/**
 * The notifications socket, as much of it as is not React.
 *
 * This replaces `socket.io-react-hook`, whose defect was structural: it kept
 * connections in a ref keyed by namespace and notified them by looking the key
 * up, while leaving its own `connect`, `connect_error` and `disconnect`
 * handlers attached to sockets whose entry it had already deleted. Anything in
 * flight across an unmount therefore threw "Cannot read properties of undefined
 * (reading 'subscribers')" from inside its provider -- a frame above any of
 * ours, where it could not be caught. Its last release was August 2024.
 *
 * What the site used of it was one namespace, two events, and a token in the
 * handshake, which is this file and one hook.
 */

/** The namespace the API serves notifications on. */
export const NOTIFICATIONS_NAMESPACE = "/notifications";

/**
 * The part of a socket used here. Structural, so what follows can be tested
 * against a double instead of a server.
 */
export type Listening = {
  on(event: string, listener: (...args: never[]) => void): unknown;
  off(event: string, listener: (...args: never[]) => void): unknown;
};

/**
 * Adds a listener and returns the function that removes that same listener.
 *
 * Removing exactly what was added, and nothing else, is the whole contract --
 * and the whole of what the dependency this replaces was doing for us.
 */
export const listen = <Message>(
  socket: Listening,
  event: string,
  onMessage: (message: Message) => void,
): (() => void) => {
  const listener = onMessage as (...args: never[]) => void;
  socket.on(event, listener);
  return () => {
    socket.off(event, listener);
  };
};
