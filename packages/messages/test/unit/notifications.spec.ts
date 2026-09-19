import { describe, expect, it } from "vitest";
import {
  NOTIFICATIONS_EXCHANGE,
  NotificationChannel,
  notificationRoutingKey,
} from "../../src";

/** Publisher and consumers bind to these names: renames are deliberate. */
describe("notification messaging names", () => {
  it("match the snapshot", () => {
    expect({
      exchange: NOTIFICATIONS_EXCHANGE,
      routingKeys: Object.values(NotificationChannel).map(
        notificationRoutingKey,
      ),
    }).toMatchInlineSnapshot(`
      {
        "exchange": "notifications.trigger",
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
