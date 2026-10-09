/** Hasura rows for Olympus tables, as the API's queries receive them. */
import type { GraphQlNotification } from "../../src/olympus/notifications/converters/NotificationConverter";
import type { GraphQlNotificationGroup } from "../../src/olympus/notifications/converters/NotificationGroupConverter";
import type { GraphQlNotificationSetting } from "../../src/olympus/notifications/converters/NotificationSettingConverter";
import type { GraphQlFullNotificationType } from "../../src/olympus/notifications/converters/NotificationTypeConverter";
import type { GraphQlWeatherLocation } from "../../src/olympus/weather/converters/WeatherLocationConverter";
import type { GraphQlWeatherStation } from "../../src/olympus/weather/converters/WeatherStationConverter";

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

export const WEATHER_STATION_ID = "3b6f1d2c-0000-4000-8000-000000000001";
export const WEATHER_STATION_MAC = "A0:B1:C2:D3:E4:F5";

export const graphQlWeatherStation = (
  overrides: Partial<GraphQlWeatherStation> = {},
): GraphQlWeatherStation => ({
  id: WEATHER_STATION_ID,
  name: "Mill Creek",
  macAddress: WEATHER_STATION_MAC.toLowerCase(),
  createdTime: "2026-09-29T18:00:00+00:00",
  lastUpdatedTime: null,
  ...overrides,
});

/**
 * A WS-5000 Customized upload's query string, shaped like one the console
 * sends (firmware 4.3.8): the path ends in `?`, so the query starts with
 * `&`, and `dateutc` has a `+` for its space.
 */
export const ambientPush = (overrides: Record<string, string> = {}): string => {
  const fields: Record<string, string> = {
    PASSKEY: WEATHER_STATION_MAC,
    stationtype: "WS-5000",
    dateutc: "2026-09-29+19:59:44",
    tempf: "58.1",
    humidity: "87",
    windspeedmph: "3.1",
    windspdmph_avg10m: "2.7",
    windgustmph: "4.5",
    maxdailygust: "9.2",
    winddir: "202",
    winddir_avg10m: "198",
    uv: "2",
    solarradiation: "312.4",
    hourlyrainin: "0.000",
    eventrainin: "0.000",
    dailyrainin: "0.000",
    weeklyrainin: "0.12",
    monthlyrainin: "1.05",
    yearlyrainin: "21.30",
    battout: "1",
    battrain: "1",
    tempinf: "70.3",
    humidityin: "45",
    baromrelin: "29.94",
    baromabsin: "29.51",
    battin: "1",
    ...overrides,
  };
  return (
    "&" +
    Object.entries(fields)
      .map(([name, value]) => `${name}=${value.replace(/:/g, "%3A")}`)
      .join("&")
  );
};
