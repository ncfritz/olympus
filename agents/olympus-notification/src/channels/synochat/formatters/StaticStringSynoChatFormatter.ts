import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import type { SynoChatNotificationEvent } from "../../../delivery/events";
import type { NotificationFormatter } from "../../../delivery/NotificationFormatter";
import type { SynoChatPayload } from "../payload";

/** A fixed message. */
export class StaticStringSynoChatFormatter implements NotificationFormatter<
  SynoChatNotificationEvent<NotificationContext>,
  SynoChatPayload
> {
  constructor(private readonly message: string) {}

  async formatNotification(): Promise<SynoChatPayload> {
    return { text: this.message };
  }
}
