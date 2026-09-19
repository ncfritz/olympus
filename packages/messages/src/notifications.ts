/**
 * Notification delivery: the API (SendNotification) publishes one message
 * per requested channel to NOTIFICATIONS_EXCHANGE; the notification agent
 * consumes them.
 */

import { exchange, route } from "./routing";

export const NOTIFICATIONS_TRIGGER_EXCHANGE = exchange(
  "notifications.trigger",
  "topic",
);
/** The exchange name (NOTIFICATIONS_TRIGGER_EXCHANGE.name). */
export const NOTIFICATIONS_EXCHANGE = NOTIFICATIONS_TRIGGER_EXCHANGE.name;

/** Delivery channels, as they appear in routing keys. */
export const NotificationChannel = {
  WEBSOCKET: "ws",
  SYNOCHAT: "synochat",
  SYNOMAIL: "synomail",
  EMAIL: "email",
} as const;
export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

/** `notifications.type.<channel>` */
export const notificationRoutingKey = (channel: NotificationChannel) =>
  `notifications.type.${channel}`;

/** Fields every notification message carries. */
export interface NotificationEvent<C extends object = object> {
  /** Unique per message (a notification sent to three channels has three). */
  eventId: string;
  notificationId: string;
  /** e.g. `system_test`, `dionysus_transcode_complete` */
  notificationType: string;
  /** ISO-8601 time the API published the message. */
  publishTime: string;
  /** ISO-8601; the agent drops the message after this time. */
  expirationTime?: string;
  /** Notification-type specific data the formatters render. */
  context: C;
}

/** Relayed to browsers; `durable` ones are also stored as notifications. */
export interface WebSocketNotificationEvent<
  C extends object = object,
> extends NotificationEvent<C> {
  level?: "success" | "info" | "warning" | "error";
  durable?: boolean;
  closable?: boolean;
  deleteOnClose?: boolean;
  /** Seconds the notification stays on screen. */
  visibleDuration?: number;
  ghost?: boolean;
  group?: string;
  /** ISO-8601 duration a stored notification lives. */
  ttl?: string;
}

/** Sent as email (routing key `synomail` or `email`). */
export interface SmtpNotificationEvent<
  C extends object = object,
> extends NotificationEvent<C> {
  /** 1 (highest) to 5 (lowest). */
  priority?: "1" | "2" | "3" | "4" | "5";
  from: string;
  replyTo?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
}

/** Sent to a Synology Chat bot (to `users`) or channel. */
export interface SynoChatNotificationEvent<
  C extends object = object,
> extends NotificationEvent<C> {
  destinationType: "bot" | "channel";
  /** Destination name, e.g. `olympus`. */
  destination: string;
  users?: number[];
}

/** The message type each channel carries. */
export interface NotificationEventByChannel {
  ws: WebSocketNotificationEvent;
  synochat: SynoChatNotificationEvent;
  synomail: SmtpNotificationEvent;
  email: SmtpNotificationEvent;
}

/** `notifications.type.<channel>` → queue `notifications.<channel>` */
export const notificationRoute = <C extends NotificationChannel>(channel: C) =>
  route<NotificationEventByChannel[C]>(
    NOTIFICATIONS_TRIGGER_EXCHANGE,
    notificationRoutingKey(channel),
  );
