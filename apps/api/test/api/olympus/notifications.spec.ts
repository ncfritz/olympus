import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { NotificationsGateway } from "../../../src/ws/gateway/NotificationsGateway";
import {
  base64Json,
  graphQlNotification,
  graphQlNotificationGroup,
  graphQlNotificationSetting,
  graphQlNotificationType,
} from "../../fixtures/olympus";
import { createTestApp, type TestApp } from "../../support/testApp";

const NOW = new Date("2026-09-18T12:00:00.000Z");

const unreadCount = (count: number) => ({
  olympus_notifications_aggregate: { aggregate: { count } },
});

describe("Olympus notifications API", () => {
  let t: TestApp;
  let gatewaySend: Mock<NotificationsGateway["send"]>;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => {
    t.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    gatewaySend = vi.fn<NotificationsGateway["send"]>();
    vi.spyOn(t.app.get(NotificationsGateway), "send").mockImplementation(
      gatewaySend,
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("PUT /v1/olympus/notification/:notificationId/acknowledge (AcknowledgeNotification)", () => {
    const url = "/v1/olympus/notification/notification-1/acknowledge";

    beforeEach(() => {
      t.graphql.on("GetUnreadCount", unreadCount(3));
    });

    it("acknowledges, expires after the ttl and deletes seven days later", async () => {
      t.graphql.on("GetNotification", {
        olympus_notifications: [graphQlNotification()],
      });
      t.graphql.on("UpdateNotification", {
        update_olympus_notifications_by_pk: graphQlNotification({
          acknowledged: true,
          notificationGroup: graphQlNotificationGroup(),
        }),
      });

      const res = await t
        .http()
        .put(url)
        .send({ acknowledged: true, ttl: "PT1H" });

      expect(res.status).toBe(200);
      expect(res.body.notification.acknowledged).toBe(true);
      expect(t.graphql.calls("UpdateNotification")[0].variables).toEqual({
        eventId: "event-1",
        acknowledged: true,
        expirationTime: "2026-09-18T13:00:00.000Z",
        deletionTime: "2026-09-25T13:00:00.000Z",
      });
      expect(gatewaySend).toHaveBeenCalledWith("notification.refresh", {
        groupId: "group-1",
        unreadCount: 3,
      });
    });

    it("defaults the ttl to three days", async () => {
      t.graphql.on("GetNotification", {
        olympus_notifications: [graphQlNotification()],
      });
      t.graphql.on("UpdateNotification", {
        update_olympus_notifications_by_pk: graphQlNotification({
          acknowledged: true,
        }),
      });

      await t.http().put(url).send({ acknowledged: true }).expect(200);

      expect(t.graphql.calls("UpdateNotification")[0].variables).toMatchObject({
        expirationTime: "2026-09-21T12:00:00.000Z",
        deletionTime: "2026-09-28T12:00:00.000Z",
      });
    });

    it("un-acknowledging restores the expiration from the deletion time", async () => {
      t.graphql.on("GetNotification", {
        olympus_notifications: [
          graphQlNotification({
            acknowledged: true,
            deletionTime: "2026-10-02T12:00:00Z",
          }),
        ],
      });
      t.graphql.on("UpdateNotification", {
        update_olympus_notifications_by_pk: graphQlNotification(),
      });

      await t.http().put(url).send({ acknowledged: false }).expect(200);

      expect(t.graphql.calls("UpdateNotification")[0].variables).toEqual({
        eventId: "event-1",
        acknowledged: false,
        expirationTime: "2026-09-25T12:00:00.000Z",
        deletionTime: undefined,
      });
    });

    it("un-acknowledging without a deletion time keeps the expiration", async () => {
      t.graphql.on("GetNotification", {
        olympus_notifications: [
          graphQlNotification({
            acknowledged: true,
            expirationTime: "2026-09-30T08:00:00Z",
          }),
        ],
      });
      t.graphql.on("UpdateNotification", {
        update_olympus_notifications_by_pk: graphQlNotification(),
      });

      await t.http().put(url).send({ acknowledged: false }).expect(200);

      expect(t.graphql.calls("UpdateNotification")[0].variables).toMatchObject({
        expirationTime: "2026-09-30T08:00:00.000Z",
      });
    });

    it("returns 304 without updating when the state is unchanged", async () => {
      t.graphql.on("GetNotification", {
        olympus_notifications: [graphQlNotification({ acknowledged: true })],
      });

      const res = await t.http().put(url).send({ acknowledged: true });

      expect(res.status).toBe(304);
      expect(t.graphql.calls("UpdateNotification")).toHaveLength(0);
      expect(gatewaySend).not.toHaveBeenCalled();
    });

    it("returns 404 for an unknown notification", async () => {
      t.graphql.on("GetNotification", { olympus_notifications: [] });

      await t.http().put(url).send({ acknowledged: true }).expect(404);
    });
  });

  describe("POST /v1/olympus/notifications (CreateNotification)", () => {
    const body = (overrides: Record<string, unknown> = {}) => ({
      notification: {
        eventId: "event-1",
        notificationId: "notification-1",
        notificationType: "type-1",
        level: "info",
        ttl: "PT1H",
        group: "System",
        payload: { message: "hello" },
        ...overrides,
      },
    });

    beforeEach(() => {
      t.graphql.on("CountDuplicateNotifications", unreadCount(0));
      t.graphql.on("GetUnreadCount", unreadCount(1));
      t.graphql.on("CreateNotification", {
        insert_olympus_notifications: { returning: [graphQlNotification()] },
      });
    });

    it("stores the notification and returns 201", async () => {
      const res = await t.http().post("/v1/olympus/notifications").send(body());

      expect(res.status).toBe(201);
      expect(res.body.notification).toMatchObject({
        eventId: "event-1",
        notificationId: "notification-1",
        payload: { message: "hello" },
      });
      expect(t.graphql.calls("CreateNotification")[0].variables).toEqual({
        deletionTime: "2026-09-25T13:00:00.000Z",
        eventId: "event-1",
        eventTime: "2026-09-18T12:00:00.000Z",
        expirationTime: "2026-09-18T13:00:00.000Z",
        group: "System",
        level: "info",
        notificationId: "notification-1",
        notificationType: "type-1",
        payload: base64Json({ message: "hello" }),
        ttl: "PT1H",
      });
      expect(gatewaySend).toHaveBeenCalledWith(
        "notification.refresh",
        expect.objectContaining({ unreadCount: 1 }),
      );
    });

    it("leaves expiration and deletion unset without a ttl", async () => {
      await t
        .http()
        .post("/v1/olympus/notifications")
        .send(body({ ttl: undefined }))
        .expect(201);

      expect(t.graphql.calls("CreateNotification")[0].variables).toMatchObject({
        expirationTime: undefined,
        deletionTime: undefined,
      });
    });

    it("uses the notification type's default group when none is given", async () => {
      t.graphql.on("GetDefaultGroupForNotificationType", {
        olympus_notification_type: [{ defaultGroupId: "media" }],
      });

      await t
        .http()
        .post("/v1/olympus/notifications")
        .send(body({ group: " " }))
        .expect(201);

      expect(
        t.graphql.calls("GetDefaultGroupForNotificationType")[0].variables,
      ).toEqual({ type: "type-1" });
      expect(t.graphql.calls("CreateNotification")[0].variables).toMatchObject({
        group: "media",
      });
    });

    it("falls back to the general group for an unknown type", async () => {
      t.graphql.on("GetDefaultGroupForNotificationType", {
        olympus_notification_type: [],
      });

      await t
        .http()
        .post("/v1/olympus/notifications")
        .send(body({ group: undefined }))
        .expect(201);

      expect(t.graphql.calls("CreateNotification")[0].variables).toMatchObject({
        group: "general",
      });
    });

    it("returns 409 when the event or notification ID exists", async () => {
      t.graphql.on("CountDuplicateNotifications", unreadCount(1));

      await t.http().post("/v1/olympus/notifications").send(body()).expect(409);

      expect(t.graphql.calls("CreateNotification")).toHaveLength(0);
    });
  });

  describe("DELETE /v1/olympus/notification/:notificationId (DeleteNotification)", () => {
    it("deletes the notification and returns it", async () => {
      t.graphql.on("DeleteNotification", {
        delete_olympus_notifications: { returning: [graphQlNotification()] },
      });
      t.graphql.on("GetUnreadCount", unreadCount(0));

      const res = await t
        .http()
        .delete("/v1/olympus/notification/notification-1");

      expect(res.status).toBe(200);
      expect(res.body.notification.notificationId).toBe("notification-1");
      expect(t.graphql.calls("DeleteNotification")[0].variables).toEqual({
        notificationId: "notification-1",
      });
      expect(gatewaySend).toHaveBeenCalledOnce();
    });

    it("returns 404 when nothing was deleted", async () => {
      t.graphql.on("DeleteNotification", {
        delete_olympus_notifications: { returning: [] },
      });

      await t.http().delete("/v1/olympus/notification/missing").expect(404);
    });
  });

  describe("GET /v1/olympus/notifications/unreadCount (GetUnreadNotificationCount)", () => {
    it("returns the unacknowledged count", async () => {
      t.graphql.on("GetUnreadCount", unreadCount(7));

      const res = await t.http().get("/v1/olympus/notifications/unreadCount");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ unreadCount: 7 });
    });

    it("returns 500 when Hasura fails", async () => {
      t.graphql.fail("GetUnreadCount");

      await t.http().get("/v1/olympus/notifications/unreadCount").expect(500);
    });
  });

  describe("GET /v1/olympus/notifications/groups (ListNotificationGroups)", () => {
    beforeEach(() => {
      t.graphql.on("ListNotificationGroups", {
        olympus_notification_groups: [graphQlNotificationGroup()],
      });
    });
    const document = () =>
      t.graphql.calls("ListNotificationGroups")[0].document;

    it("lists groups without their types by default", async () => {
      const res = await t.http().get("/v1/olympus/notifications/groups");

      expect(res.status).toBe(200);
      expect(res.body.groups).toMatchObject([
        { id: "group-1", name: "System" },
      ]);
      expect(document()).not.toContain("notificationTypes");
    });

    it("includes the types when asked", async () => {
      await t
        .http()
        .get("/v1/olympus/notifications/groups?includeNotificationTypes=true")
        .expect(200);

      expect(document()).toContain("notificationTypes");
    });

    it("treats includeNotificationTypes=false as false", async () => {
      await t
        .http()
        .get("/v1/olympus/notifications/groups?includeNotificationTypes=false")
        .expect(200);

      expect(document()).not.toContain("notificationTypes");
    });

    it("rejects a non-boolean flag", async () => {
      await t
        .http()
        .get("/v1/olympus/notifications/groups?includeNotificationTypes=maybe")
        .expect(400);
    });
  });

  describe("GET /v1/olympus/notifications/types (ListNotificationTypes)", () => {
    it("lists the types with their channel support", async () => {
      t.graphql.on("ListNotificationTypes", {
        olympus_notification_type: [graphQlNotificationType()],
      });

      const res = await t.http().get("/v1/olympus/notifications/types");

      expect(res.status).toBe(200);
      expect(res.body.notificationTypes).toMatchObject([
        {
          id: "type-1",
          name: "system_test",
          supportsWebSocket: true,
          supportsSynoMail: false,
          webSocketDefault: true,
        },
      ]);
    });
  });

  describe("GET /v1/olympus/notifications/settings (ListNotificationSettings)", () => {
    it("returns saved settings, filling unsaved types from their defaults", async () => {
      t.graphql.on("ListNotificationSettings", {
        olympus_notification_settings: [graphQlNotificationSetting()],
        olympus_notification_type: [
          graphQlNotificationType(),
          graphQlNotificationType({
            id: "type-2",
            name: "media_added",
            webSocketDefault: false,
            emailDefault: true,
          }),
        ],
      });

      const res = await t.http().get("/v1/olympus/notifications/settings");

      expect(res.status).toBe(200);
      expect(res.body.notificationSettings["type-1"]).toMatchObject({
        webSocketEnabled: true,
        synoChatEnabled: true,
        synoMailEnabled: false,
        emailEnabled: false,
        lastUpdatedTime: "2026-02-01T00:00:00.000Z",
      });
      expect(res.body.notificationSettings["type-2"]).toMatchObject({
        notificationType: { id: "type-2" },
        webSocketEnabled: false,
        synoChatEnabled: false,
        synoMailEnabled: false,
        emailEnabled: true,
      });
      expect(t.graphql.calls("ListNotificationSettings")[0].variables).toEqual({
        username: "ncfritz",
      });
    });
  });

  describe("PUT /v1/olympus/notifications/settings/:notificationType (UpdateNotificationSetting)", () => {
    it("upserts the user's setting for the type", async () => {
      t.graphql.on("UpsertNotificationSetting", {
        insert_olympus_notification_settings_one: graphQlNotificationSetting({
          email: true,
        }),
      });

      const res = await t
        .http()
        .put("/v1/olympus/notifications/settings/type-1")
        .send({
          notificationSetting: {
            webSocketEnabled: true,
            synoChatEnabled: true,
            synoMailEnabled: false,
            emailEnabled: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.notificationSetting).toMatchObject({
        emailEnabled: true,
        notificationType: { id: "type-1" },
      });
      expect(t.graphql.calls("UpsertNotificationSetting")[0].variables).toEqual(
        {
          notificationTypeId: "type-1",
          username: "ncfritz",
          webSocket: true,
          synoChat: true,
          synoMail: false,
          email: true,
        },
      );
    });
  });

  describe("GET /v1/olympus/notifications (ListNotifications)", () => {
    beforeEach(() => {
      t.graphql.on("ListNotifications", {
        olympus_notifications: [graphQlNotification()],
        olympus_notification_statistics: [
          { group: "System", level: "info", count: 2, acknowledged: false },
          { group: "System", level: "error", count: 1, acknowledged: true },
          { group: "Media", level: "success", count: 4, acknowledged: false },
        ],
      });
    });
    const document = () => t.graphql.calls("ListNotifications")[0].document;

    it("returns recent notifications and per-group statistics", async () => {
      const res = await t.http().get("/v1/olympus/notifications");

      expect(res.status).toBe(200);
      expect(res.body.recent).toHaveLength(1);
      expect(res.body.statistics).toEqual({
        System: {
          total: 3,
          unread: 2,
          info: 2,
          success: 0,
          warning: 0,
          error: 1,
        },
        Media: {
          total: 4,
          unread: 4,
          info: 0,
          success: 4,
          warning: 0,
          error: 0,
        },
      });
      expect(document()).toContain("limit: 10");
    });

    it("limits to the requested count", async () => {
      await t.http().get("/v1/olympus/notifications?count=5").expect(200);

      expect(document()).toContain("limit: 5");
    });

    it("rejects a non-numeric count", async () => {
      await t
        .http()
        .get("/v1/olympus/notifications?count=5)%20%7B%20x")
        .expect(400);

      expect(t.graphql.calls("ListNotifications")).toHaveLength(0);
    });
  });

  describe("GET /v1/olympus/notifications/group/:groupId/notifications (ListNotificationsInGroup)", () => {
    const url = "/v1/olympus/notifications/group/System/notifications";

    beforeEach(() => {
      t.graphql.on("ListNotificationsInGroup", {
        olympus_notifications: [graphQlNotification()],
        ...unreadCount(12),
      });
    });
    const call = () => t.graphql.calls("ListNotificationsInGroup")[0];

    it("returns a page of the group's notifications and the total", async () => {
      const res = await t.http().get(url);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(12);
      expect(res.body.notifications).toHaveLength(1);
      expect(call().variables).toEqual({ group: "System" });
      expect(call().document).toContain(
        "limit: 10, offset: 0, order_by: [{createdTime: desc}]",
      );
    });

    it("applies the paging and sort parameters", async () => {
      await t
        .http()
        .get(`${url}?pageSize=5&startPage=2&sort=asc&sortBy=eventTime`)
        .expect(200);

      expect(call().document).toContain(
        "limit: 5, offset: 10, order_by: [{eventTime: asc}]",
      );
    });

    it.each([
      ["sortBy", "createdTime: asc}] where: {"],
      ["sort", "sideways"],
      ["pageSize", "-1"],
      ["startPage", "one"],
    ])("rejects an invalid %s", async (param, value) => {
      await t
        .http()
        .get(url)
        .query({ [param]: value })
        .expect(400);

      expect(t.graphql.calls("ListNotificationsInGroup")).toHaveLength(0);
    });
  });

  describe("POST /v1/olympus/notifications/publish (SendNotification)", () => {
    const typeSupport = (overrides: Record<string, boolean> = {}) => ({
      olympus_notification_settings_by_pk: null,
      olympus_notification_type_by_pk: {
        supportsWebSocket: true,
        supportsSynoChat: true,
        supportsSynoMail: true,
        supportsEmail: true,
        webSocketDefault: true,
        synoChatDefault: true,
        synoMailDefault: false,
        emailDefault: true,
        ...overrides,
      },
    });
    const webSocketDestination = { level: "info", group: "System" };
    const smtpDestination = {
      from: "olympus@ncfritz.net",
      to: [{ value: "neil@example.com" }],
      cc: [{ value: "cc@example.com" }],
    };

    it("enqueues each enabled destination and returns 202", async () => {
      t.graphql.on("GetNotificationSetting", typeSupport());

      const res = await t
        .http()
        .post("/v1/olympus/notifications/publish")
        .send({
          type: "type-1",
          context: { title: "Hi" },
          webSocketDestination,
          smtpDestination,
        });

      expect(res.status).toBe(202);
      expect(res.body.webSocketDestination.status).toBe("success");
      expect(res.body.externalMailDestination.status).toBe("success");
      expect(t.amqp.publish).toHaveBeenCalledTimes(2);

      const [exchange, routingKey, message] = t.amqp.publish.mock.calls.find(
        ([, key]) => key === "notifications.type.ws",
      )!;
      expect(exchange).toBe("notifications.trigger");
      expect(routingKey).toBe("notifications.type.ws");
      expect(message).toMatchObject({
        notificationId: res.body.notificationId,
        eventId: res.body.webSocketDestination.eventId,
        notificationType: "type-1",
        level: "info",
        group: "System",
        context: { title: "Hi" },
        publishTime: "2026-09-18T12:00:00.000Z",
      });

      const [, , mail] = t.amqp.publish.mock.calls.find(
        ([, key]) => key === "notifications.type.email",
      )!;
      expect(mail).toMatchObject({
        from: "olympus@ncfritz.net",
        to: ["neil@example.com"],
        cc: ["cc@example.com"],
      });
      expect(t.graphql.calls("GetNotificationSetting")[0].variables).toEqual({
        username: "ncfritz",
        notificationTypeId: "type-1",
      });
    });

    it("skips destinations the type or the user has turned off", async () => {
      t.graphql.on("GetNotificationSetting", {
        ...typeSupport({ supportsSynoChat: false }),
        olympus_notification_settings_by_pk: {
          webSocket: false,
          synoChat: true,
          synoMail: true,
          email: false,
        },
      });

      const res = await t
        .http()
        .post("/v1/olympus/notifications/publish")
        .send({
          type: "type-1",
          webSocketDestination,
          synoChatDestination: { destination: "general" },
          synoMailDestination: smtpDestination,
          smtpDestination,
        });

      expect(res.status).toBe(202);
      expect(t.amqp.publish).toHaveBeenCalledOnce();
      expect(t.amqp.publish.mock.calls[0][1]).toBe(
        "notifications.type.synomail",
      );
      expect(res.body.synoMailDestination.status).toBe("success");
      expect(res.body.webSocketDestination).toBeUndefined();
      expect(res.body.synoChatDestination).toBeUndefined();
      expect(res.body.externalMailDestination).toBeUndefined();
    });

    it("returns 207 when a destination fails to enqueue", async () => {
      t.graphql.on("GetNotificationSetting", typeSupport());
      t.amqp.publish.mockImplementation(async (_exchange, key) => {
        if (key === "notifications.type.synochat") throw new Error("down");
        return true;
      });

      const res = await t
        .http()
        .post("/v1/olympus/notifications/publish")
        .send({
          type: "type-1",
          webSocketDestination,
          synoChatDestination: { destination: "general" },
        });

      expect(res.status).toBe(207);
      expect(res.body.webSocketDestination.status).toBe("success");
      expect(res.body.synoChatDestination.status).toBe("failure");
    });

    it("returns 400 for an unknown notification type", async () => {
      t.graphql.on("GetNotificationSetting", {
        olympus_notification_settings_by_pk: null,
        olympus_notification_type_by_pk: null,
      });

      await t
        .http()
        .post("/v1/olympus/notifications/publish")
        .send({ type: "nope", webSocketDestination })
        .expect(400);

      expect(t.amqp.publish).not.toHaveBeenCalled();
    });

    it("returns 400 for a notification that has already expired", async () => {
      const res = await t
        .http()
        .post("/v1/olympus/notifications/publish")
        .send({
          type: "type-1",
          expirationTime: "2026-09-18T11:00:00Z",
          webSocketDestination,
        });

      expect(res.status).toBe(400);
      expect(res.body.notificationId).toEqual(expect.any(String));
      expect(t.graphql.request).not.toHaveBeenCalled();
    });
  });
});
