import { NotificationChannel } from "@ncfritz/olympus-messages";

/**
 * RabbitMQ names this agent consumes. The exchange and routing keys come
 * from the shared contract (@ncfritz/olympus-messages); the queues are the
 * agent's own, one durable queue per channel.
 */
export {
  NotificationChannel,
  notificationRoutingKey,
  NOTIFICATIONS_EXCHANGE,
} from "@ncfritz/olympus-messages";

/** The queue of a channel, e.g. `notifications.ws`. */
export const channelQueue = (channel: NotificationChannel) =>
  `notifications.${channel}`;
