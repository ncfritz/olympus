/**
 * RabbitMQ names this agent consumes. The API publishes to
 * NOTIFICATIONS_EXCHANGE with routing key `notifications.type.<channel>`;
 * each channel has its own durable queue.
 */
export const NOTIFICATIONS_PREFIX = "notifications";
export const NOTIFICATIONS_EXCHANGE = `${NOTIFICATIONS_PREFIX}.trigger`;

export const CHANNEL_WEBSOCKET = "ws";
export const CHANNEL_SYNOCHAT = "synochat";
export const CHANNEL_SYNOMAIL = "synomail";
export const CHANNEL_GMAIL = "email";

/** The queue of a channel, e.g. `notifications.ws`. */
export const channelQueue = (channel: string) =>
  `${NOTIFICATIONS_PREFIX}.${channel}`;

/** The routing key of a channel, e.g. `notifications.type.ws`. */
export const channelRoutingKey = (channel: string) =>
  `${NOTIFICATIONS_PREFIX}.type.${channel}`;
