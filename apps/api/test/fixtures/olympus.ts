/** Hasura rows for Olympus tables, as the API's queries receive them. */
import type { GraphQlNotification } from "../../src/olympus/notifications/converters/NotificationConverter";
import type { GraphQlNotificationGroup } from "../../src/olympus/notifications/converters/NotificationGroupConverter";
import type { GraphQlNotificationSetting } from "../../src/olympus/notifications/converters/NotificationSettingConverter";
import type { GraphQlFullNotificationType } from "../../src/olympus/notifications/converters/NotificationTypeConverter";
import type { GraphQlWeatherLocation } from "../../src/olympus/weather/converters/WeatherLocationConverter";

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

export const WEATHER_LOCATION_ID = "7d3e2a10-0000-4000-8000-000000000001";

export const graphQlWeatherLocation = (
  overrides: Partial<GraphQlWeatherLocation> = {},
): GraphQlWeatherLocation => ({
  id: WEATHER_LOCATION_ID,
  label: "Washington",
  placeId: "ChIJplace-mill-creek",
  placeName: "Mill Creek, WA, USA",
  latitude: 47.8525684,
  longitude: -122.238287,
  position: 0,
  isDefault: true,
  createdTime: "2026-09-29T12:00:00Z",
  lastUpdatedTime: "2026-09-29T12:30:00Z",
  ...overrides,
});
