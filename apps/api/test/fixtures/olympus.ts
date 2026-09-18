/** Hasura rows for Olympus tables, as the API's queries receive them. */
import type { GraphQlNotification } from "../../src/convert/olympus/notifications/NotificationConverter";
import type { GraphQlNotificationGroup } from "../../src/convert/olympus/notifications/NotificationGroupConverter";
import type { GraphQlNotificationSetting } from "../../src/convert/olympus/notifications/NotificationSettingConverter";
import type { GraphQlFullNotificationType } from "../../src/convert/olympus/notifications/NotificationTypeConverter";

export const base64Json = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64");

export const graphQlNotificationType = (
  overrides: Partial<GraphQlFullNotificationType> = {},
): GraphQlFullNotificationType => ({
  id: "type-1",
  name: "system_test",
  description: "A test notification",
  createdTime: "2026-01-01T00:00:00Z",
  supportsWebSocket: true,
  supportsSynoChat: true,
  supportsSynoMail: false,
  supportsEmail: true,
  webSocketDefault: true,
  synoChatDefault: false,
  synoMailDefault: false,
  emailDefault: false,
  ...overrides,
});

export const graphQlNotificationGroup = (
  overrides: Partial<GraphQlNotificationGroup> = {},
): GraphQlNotificationGroup => ({
  id: "group-1",
  name: "System",
  description: "System notifications",
  createdTime: "2026-01-01T00:00:00Z",
  ...overrides,
});

export const graphQlNotification = (
  overrides: Partial<GraphQlNotification> = {},
): GraphQlNotification => ({
  eventId: "event-1",
  notificationId: "notification-1",
  eventTime: "2026-09-18T12:00:00Z",
  notificationType: { id: "type-1", name: "system_test" } as never,
  level: "info" as GraphQlNotification["level"],
  acknowledged: false,
  expirationTime: "2026-09-25T12:00:00Z",
  createdTime: "2026-09-18T12:00:01Z",
  payload: base64Json({ message: "hello" }),
  ...overrides,
});

export const graphQlNotificationSetting = (
  overrides: Partial<GraphQlNotificationSetting> = {},
): GraphQlNotificationSetting => ({
  createdTime: "2026-01-01T00:00:00Z",
  lastUpdatedTime: "2026-02-01T00:00:00Z",
  username: "ncfritz",
  notificationType: graphQlNotificationType(),
  webSocket: true,
  synoMail: false,
  synoChat: true,
  email: false,
  ...overrides,
});
