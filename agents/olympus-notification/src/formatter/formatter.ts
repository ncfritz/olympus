import {
  BaseDestinationEvent,
  NotificationContext,
} from "@ncfritz/olympus-model/dist/notifications";

export abstract class NotificationFormatter<
  I extends BaseDestinationEvent<NotificationContext>,
  O,
> {
  abstract formatNotification(notification: I): Promise<O>;
}
