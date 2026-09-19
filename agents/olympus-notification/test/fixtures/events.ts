import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import type {
  NotificationEvent,
  SmtpNotificationEvent,
  SynoChatNotificationEvent,
  WebSocketNotificationEvent,
} from "../../src/delivery/events";

export const baseEvent = (
  overrides: Partial<NotificationEvent<NotificationContext>> = {},
): NotificationEvent<NotificationContext> => ({
  eventId: "event-1",
  notificationId: "notification-1",
  notificationType: "system_test",
  publishTime: "2026-09-19T12:00:00.000Z",
  expirationTime: "2999-01-01T00:00:00.000Z",
  context: {},
  ...overrides,
});

export const webSocketEvent = (
  overrides: Partial<WebSocketNotificationEvent<NotificationContext>> = {},
): WebSocketNotificationEvent<NotificationContext> => ({
  ...baseEvent(),
  level: "info",
  durable: false,
  closable: true,
  deleteOnClose: false,
  visibleDuration: 5000,
  ...overrides,
});

export const smtpEvent = (
  overrides: Partial<SmtpNotificationEvent<NotificationContext>> = {},
): SmtpNotificationEvent<NotificationContext> => ({
  ...baseEvent(),
  from: "Olympus <olympus@example.test>",
  to: ["someone@example.test"],
  ...overrides,
});

export const synoChatEvent = (
  overrides: Partial<SynoChatNotificationEvent<NotificationContext>> = {},
): SynoChatNotificationEvent<NotificationContext> => ({
  ...baseEvent(),
  destinationType: "channel",
  destination: "olympus",
  ...overrides,
});
