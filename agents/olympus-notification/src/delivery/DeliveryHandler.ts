import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Logger } from "@nestjs/common";
import moment from "moment";
import type { NotificationEvent } from "./events";
import type { NotificationFormatter } from "./NotificationFormatter";

/**
 * Delivery for one channel (template method): skips expired notifications,
 * finds the formatter for the notification type, formats and sends.
 * Subclasses subscribe to their queue, call deliver(), and implement
 * send() and formatterFor().
 */
export abstract class DeliveryHandler<
  E extends NotificationEvent<NotificationContext>,
  P,
> {
  protected readonly logger = new Logger(this.constructor.name);

  /** The channel's name in log messages. */
  abstract get channelName(): string;

  /** Sends a formatted notification over the channel. */
  protected abstract send(notification: E, payload: P): Promise<void>;

  /** The formatter for a notification type, if this channel supports it. */
  protected abstract formatterFor(
    notificationType: string,
  ): NotificationFormatter<E, P> | undefined;

  protected async deliver(notification: E): Promise<void> {
    this.logger.log(
      `Processing notification[${notification.notificationType}]: eventId: ${notification.eventId}, notificationId: ${notification.notificationId}`,
    );

    if (notification.expirationTime) {
      const expiration = moment(notification.expirationTime);

      if (expiration && expiration.isValid()) {
        if (moment.utc().isAfter(expiration)) {
          this.logger.log("Notification is expired, nothing to do.");
          return;
        }
      } else {
        this.logger.warn(
          `Invalid ISO-8601 time: ${notification.expirationTime}, dropping notification`,
        );
        return;
      }
    } else {
      this.logger.debug(
        `No expiration time found for eventId ${notification.eventId}`,
      );
    }

    const formatter = this.formatterFor(notification.notificationType);

    if (!formatter) {
      this.logger.warn(
        `No formatter found for type "${notification.notificationType}" on ${this.channelName} channel, ignoring notification.`,
      );
      return;
    }

    try {
      this.logger.debug("Formatting notification...");
      const payload = await formatter.formatNotification(notification);

      this.logger.debug("Sending notification.");
      await this.send(notification, payload);
    } catch (e) {
      this.logger.error(
        "Failed to process notification...",
        e instanceof Error ? e.stack : String(e),
      );
    }
  }
}
