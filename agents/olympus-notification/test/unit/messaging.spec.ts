import { describe, expect, it } from "vitest";
import {
  channelQueue,
  NotificationChannel,
  notificationRoutingKey,
  NOTIFICATIONS_EXCHANGE,
} from "../../src/messaging";

/** Queues and routing keys are shared with the API: renames are deliberate. */
describe("messaging names", () => {
  it("match the snapshot", () => {
    const channels = [
      NotificationChannel.WEBSOCKET,
      NotificationChannel.SYNOCHAT,
      NotificationChannel.SYNOMAIL,
      NotificationChannel.EMAIL,
    ];
    expect({
      exchange: NOTIFICATIONS_EXCHANGE,
      queues: channels.map(channelQueue),
      routingKeys: channels.map(notificationRoutingKey),
    }).toMatchInlineSnapshot(`
      {
        "exchange": "notifications.trigger",
        "queues": [
          "notifications.ws",
          "notifications.synochat",
          "notifications.synomail",
          "notifications.email",
        ],
        "routingKeys": [
          "notifications.type.ws",
          "notifications.type.synochat",
          "notifications.type.synomail",
          "notifications.type.email",
        ],
      }
    `);
  });
});
