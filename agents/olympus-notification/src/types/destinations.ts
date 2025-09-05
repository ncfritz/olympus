import {
  NotificationContext,
  SmtpPriority,
  SynoChatDestinationType,
  WebSocketNotificationLevel,
} from "@ncfritz/olympus-sdk/olympus";

export interface BaseDestinationEvent<T extends NotificationContext> {
  eventId: string;
  notificationId: string;
  notificationType: string;
  publishTime: string;
  expirationTime: string;
  context: T;
}

export interface WebSocketDestinationEvent<T extends NotificationContext>
  extends BaseDestinationEvent<T> {
  level: WebSocketNotificationLevel;
  durable: boolean;
  closable: boolean;
  deleteOnClose: boolean;
  visibleDuration: number;
  ghost?: boolean;
  group?: string;
  ttl?: string;
}

export interface SMTPDestinationEvent<T extends NotificationContext>
  extends BaseDestinationEvent<T> {
  priority?: SmtpPriority;
  from: string;
  replyTo?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
}

export interface SynoChatDestinationEvent<T extends NotificationContext>
  extends BaseDestinationEvent<T> {
  destinationType: SynoChatDestinationType;
  destination: string;
  users?: number[];
}
