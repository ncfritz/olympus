import { describe, expect, it } from "vitest";
import {
  CHANNEL_GMAIL,
  CHANNEL_SYNOCHAT,
  CHANNEL_SYNOMAIL,
  CHANNEL_WEBSOCKET,
  channelQueue,
  channelRoutingKey,
  NOTIFICATIONS_EXCHANGE,
} from "../../src/messaging";

/** Queues and routing keys are shared with the API: renames are deliberate. */
describe("messaging names", () => {
  it("match the snapshot", () => {
    const channels = [
      CHANNEL_WEBSOCKET,
      CHANNEL_SYNOCHAT,
      CHANNEL_SYNOMAIL,
      CHANNEL_GMAIL,
    ];
    expect({
      exchange: NOTIFICATIONS_EXCHANGE,
      queues: channels.map(channelQueue),
      routingKeys: channels.map(channelRoutingKey),
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
