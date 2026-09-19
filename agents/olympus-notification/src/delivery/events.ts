import {
  NotificationContext,
  SmtpPriority,
  SynoChatDestinationType,
  WebSocketNotificationLevel,
} from "@ncfritz/olympus-sdk/olympus";

/** Fields every notification message carries. */
export interface NotificationEvent<T extends NotificationContext> {
  eventId: string;
  notificationId: string;
  notificationType: string;
  publishTime: string;
  expirationTime: string;
  context: T;
}

export interface WebSocketNotificationEvent<
  T extends NotificationContext,
> extends NotificationEvent<T> {
  level: WebSocketNotificationLevel;
  durable: boolean;
  closable: boolean;
  deleteOnClose: boolean;
  visibleDuration: number;
  ghost?: boolean;
  group?: string;
  ttl?: string;
}

export interface SmtpNotificationEvent<
  T extends NotificationContext,
> extends NotificationEvent<T> {
  priority?: SmtpPriority;
  from: string;
  replyTo?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
}

export interface SynoChatNotificationEvent<
  T extends NotificationContext,
> extends NotificationEvent<T> {
  destinationType: SynoChatDestinationType;
  destination: string;
  users?: number[];
}
