import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import type { NotificationEvent } from "./events";

/**
 * Turns a notification event into a channel's payload (P). One formatter per
 * notification type and channel, registered in the channel's formatters.
 */
export interface NotificationFormatter<
  E extends NotificationEvent<NotificationContext>,
  P,
> {
  formatNotification(notification: E): Promise<P>;
}
