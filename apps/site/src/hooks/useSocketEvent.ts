import { useEffect } from "react";
import { listen, type Listening } from "../auth/notifications";

/**
 * Subscribes to one socket event for as long as the component is mounted.
 *
 * `onMessage` has to be stable -- `useCallback` at the call site -- because a
 * new function every render would unsubscribe and resubscribe every render.
 * The socket itself is not tied to the component: see `notificationsSocket`.
 */
export const useSocketEvent = <Message>(
  socket: Listening,
  event: string,
  onMessage: (message: Message) => void,
): void => {
  useEffect(() => listen(socket, event, onMessage), [socket, event, onMessage]);
};
