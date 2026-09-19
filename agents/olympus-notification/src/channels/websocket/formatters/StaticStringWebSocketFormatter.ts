import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import type { WebSocketNotificationEvent } from "../../../delivery/events";
import type { NotificationFormatter } from "../../../delivery/NotificationFormatter";
import type { WebSocketPayload } from "../payload";

/**
 * A fixed title and message, unless the context carries `title` /
 * `message`.
 */
export class StaticStringWebSocketFormatter implements NotificationFormatter<
  WebSocketNotificationEvent<NotificationContext>,
  WebSocketPayload
> {
  constructor(
    private readonly title: string,
    private readonly message: string,
  ) {}

  async formatNotification(
    notification: WebSocketNotificationEvent<NotificationContext>,
  ): Promise<WebSocketPayload> {
    return {
      type: "plain",
      value: {
        title: notification.context["title"] || this.title,
        message: notification.context["message"] || this.message,
      },
    };
  }
}
