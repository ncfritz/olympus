import {
  BaseDestinationEvent,
  NotificationContext,
  WebSocketPayload,
} from "@ncfritz/olympus-model/dist/notifications";
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
        // @ts-expect-error expected
        title: notification.context["title"] || this.title,
        // @ts-expect-error expected
        message: notification.context["message"] || this.message,
      },
    };
  }
}
