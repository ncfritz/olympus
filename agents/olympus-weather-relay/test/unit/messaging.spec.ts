import { describe, expect, it } from "vitest";
import {
  RELAY_QUEUE_ARGUMENTS,
  relayQueue,
  WEATHER_ARCHIVE_LINE_ROUTE,
  WEATHER_RELAY_HANDLER,
} from "../../src/messaging";

/**
 * The exchange is shared with the API and the broker's shovel, and a
 * queue's arguments are fixed once it exists: changes are deliberate.
 */
describe("messaging names", () => {
  it("match the snapshot", () => {
    expect({
      exchange: WEATHER_ARCHIVE_LINE_ROUTE.exchange,
      routingKey: WEATHER_ARCHIVE_LINE_ROUTE.routingKey,
      handler: WEATHER_RELAY_HANDLER,
      queue: relayQueue("olympus_dev"),
      arguments: RELAY_QUEUE_ARGUMENTS,
    }).toMatchInlineSnapshot(`
      {
        "arguments": {
          "x-expires": 604800000,
          "x-max-length": 30000,
          "x-message-ttl": 172800000,
          "x-overflow": "drop-head",
        },
        "exchange": {
          "name": "weather.station.reports",
          "type": "fanout",
        },
        "handler": "weatherRelay",
        "queue": "weather.station.reports.olympus_dev",
        "routingKey": "weather.archive.line",
      }
    `);
  });
});
