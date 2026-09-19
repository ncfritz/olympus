import { ConsumeMessage } from "amqplib";
import moment from "moment";
import { NotificationFormatter } from "../formatter/formatter";
import { BaseDestinationEvent } from "../types/destinations";
import { logger } from "../util/logger";

// @ts-expect-error it's okay
export abstract class BaseHandler<T extends BaseDestinationEvent, P> {
  abstract getChannelName(): string;
  abstract handle(msg: T, amqpMsg: ConsumeMessage): Promise<void>;
  abstract transact(msg: T, payload: P): Promise<void>;

  abstract getFormatterForType(
    type: string,
  ): NotificationFormatter<T, P> | undefined;

  protected async processNotification(notification: T): Promise<void> {
    logger.info(
      `Processing notification[${notification.notificationType}]: eventId: ${notification.eventId}, notificationId: ${notification.notificationId}`,
    );

    if (notification.expirationTime) {
      const expiration = moment(notification.expirationTime);

      if (expiration && expiration.isValid()) {
        const now = moment.utc();

        if (now.isAfter(expiration)) {
          logger.info("Notification is expired, nothing to do.");
          return;
        }
      } else {
        logger.warn(
          `Invalid ISO-8601 time: ${notification.expirationTime}, dropping notification`,
        );
        return;
      }
    } else {
      logger.debug(
        `No expiration time found for eventId ${notification.eventId}`,
      );
    }

    const formatter = this.getFormatterForType(notification.notificationType);

    if (!formatter) {
      logger.warn(
        `No formatter found for type "${notification.notificationType}" on ${this.getChannelName()} channel, ignoring notification.`,
      );
      return;
    }

    try {
      logger.debug("Formatting notification...");
      const payload = await formatter.formatNotification(notification);

      logger.debug("Calling transact() for notification transport.");
      await this.transact(notification, payload);
    } catch (e) {
      logger.error("Failed to process notification...", e);
    }
  }
}
