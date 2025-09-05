import { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { BaseDestinationEvent } from "../types/destinations";

export abstract class NotificationFormatter<
  I extends BaseDestinationEvent<NotificationContext>,
  O,
> {
  abstract formatNotification(notification: I): Promise<O>;
}
