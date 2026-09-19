import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import type { WebSocketNotificationEvent } from "../../../delivery/events";
import type { NotificationFormatter } from "../../../delivery/NotificationFormatter";
import type { WebSocketPayload } from "../payload";

/** Passes the notification's context to the browser, which renders it. */
export class ContextWebSocketFormatter implements NotificationFormatter<
  WebSocketNotificationEvent<NotificationContext>,
  WebSocketPayload
> {
  async formatNotification(
    notification: WebSocketNotificationEvent<NotificationContext>,
  ): Promise<WebSocketPayload> {
    return { type: "context", value: notification.context };
  }
}
