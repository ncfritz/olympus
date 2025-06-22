import {
  BaseDestinationEvent,
  NotificationContext,
  SynoChatPayload,
} from "@ncfritz/olympus-model/dist/notifications";
import { NotificationFormatter } from "./formatter";

export class SynoChatStaticStringFormatter<
  T extends NotificationContext,
> extends NotificationFormatter<BaseDestinationEvent<T>, SynoChatPayload> {
  private readonly message: string;

  constructor(message: string) {
    super();

    this.message = message;
  }

  async formatNotification(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    notification: BaseDestinationEvent<T>,
  ): Promise<SynoChatPayload> {
    return {
      text: this.message,
    };
  }
}
