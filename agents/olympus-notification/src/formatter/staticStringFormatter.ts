import { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { BaseDestinationEvent } from "../types/destinations";
import { WebSocketPayload } from "../types/payloads";
import { NotificationFormatter } from "./formatter";

export class WebSocketStaticStringFormatter<
  T extends NotificationContext,
> extends NotificationFormatter<BaseDestinationEvent<T>, WebSocketPayload> {
  private readonly title: string;
  private readonly message: string;

  constructor(title: string, message: string) {
    super();

    this.title = title;
    this.message = message;
  }

  async formatNotification(
    notification: BaseDestinationEvent<T>,
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
