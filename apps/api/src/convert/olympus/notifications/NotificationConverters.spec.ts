import { describe, expect, it } from "vitest";
import {
  graphQlNotification,
  graphQlNotificationGroup,
  graphQlNotificationSetting,
  graphQlNotificationType,
} from "../../../../test/fixtures/olympus";
import { toDomainObject as toNotification } from "./NotificationConverter";
import { toDomainObject as toGroup } from "./NotificationGroupConverter";
import { toDomainObject as toSetting } from "./NotificationSettingConverter";
import {
  toDomainObject as toType,
  toFullDomainObject as toFullType,
} from "./NotificationTypeConverter";

describe("NotificationConverter", () => {
  it("decodes the base64 JSON payload and parses times", () => {
    const notification = toNotification(graphQlNotification());
    expect(notification.payload).toEqual({ message: "hello" });
    expect(notification.eventTime.toISOString()).toBe(
      "2026-09-18T12:00:00.000Z",
    );
    expect(notification.expirationTime?.toISOString()).toBe(
      "2026-09-25T12:00:00.000Z",
    );
    expect(notification.acknowledged).toBe(false);
    expect(notification.notificationGroup).toBeUndefined();
  });

  it("uses an empty payload and no expiration when they are absent", () => {
    const notification = toNotification(
      graphQlNotification({
        payload: undefined,
        expirationTime: undefined,
        acknowledged: undefined,
      }),
    );
    expect(notification.payload).toEqual({});
    expect(notification.expirationTime).toBeUndefined();
    expect(notification.acknowledged).toBe(false);
  });

  it("converts the notification group when present", () => {
    const notification = toNotification(
      graphQlNotification({ notificationGroup: graphQlNotificationGroup() }),
    );
    expect(notification.notificationGroup).toMatchObject({
      id: "group-1",
      name: "System",
    });
  });
});

describe("NotificationGroupConverter", () => {
  it("maps a group and its notification types", () => {
    const group = toGroup(
      graphQlNotificationGroup({
        notificationTypes: [graphQlNotificationType()],
      }),
    );
    expect(group).toMatchObject({
      id: "group-1",
      description: "System notifications",
    });
    expect(group.createdTime.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(group.notificationTypes?.[0]).toMatchObject({
      name: "system_test",
      supportsWebSocket: true,
    });
  });

  it("omits notificationTypes when not selected", () => {
    expect(
      toGroup(graphQlNotificationGroup()).notificationTypes,
    ).toBeUndefined();
  });
});

describe("NotificationTypeConverter", () => {
  it("maps the base type with its default group", () => {
    const type = toType({
      ...graphQlNotificationType(),
      defaultGroup: graphQlNotificationGroup(),
    });
    expect(type).toMatchObject({ id: "type-1", name: "system_test" });
    expect(type.defaultGroup?.name).toBe("System");
  });

  it("adds protocol support and defaults for the full type", () => {
    expect(toFullType(graphQlNotificationType())).toMatchObject({
      supportsWebSocket: true,
      supportsSynoChat: true,
      supportsSynoMail: false,
      supportsEmail: true,
      webSocketDefault: true,
      synoChatDefault: false,
      synoMailDefault: false,
      emailDefault: false,
    });
  });
});

describe("NotificationSettingConverter", () => {
  it("maps channel flags to *Enabled", () => {
    const setting = toSetting(graphQlNotificationSetting());
    expect(setting).toMatchObject({
      webSocketEnabled: true,
      synoMailEnabled: false,
      synoChatEnabled: true,
      emailEnabled: false,
      notificationType: { name: "system_test" },
    });
    expect(setting.lastUpdatedTime?.toISOString()).toBe(
      "2026-02-01T00:00:00.000Z",
    );
  });

  it("leaves lastUpdatedTime undefined when never updated", () => {
    expect(
      toSetting(graphQlNotificationSetting({ lastUpdatedTime: undefined }))
        .lastUpdatedTime,
    ).toBeUndefined();
  });
});
