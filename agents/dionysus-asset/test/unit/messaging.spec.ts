import { describe, expect, it } from "vitest";
import {
  CHANNELS,
  CONTENT_SUBSCRIPTIONS,
  DOWNLOAD_SUBSCRIPTIONS,
  MEDIA_SUBSCRIPTIONS,
} from "../../src/messaging";

/**
 * The queues predate the shared contract; renaming one strands its
 * messages, and the channels set how much runs at once.
 */
describe("subscriptions", () => {
  it("keeps the queue names, routing keys and channels", () => {
    expect({
      content: CONTENT_SUBSCRIPTIONS,
      media: MEDIA_SUBSCRIPTIONS,
      downloads: DOWNLOAD_SUBSCRIPTIONS,
      channels: CHANNELS,
    }).toMatchSnapshot();
  });

  it("names each media queue after its job type", () => {
    for (const [name, options] of Object.entries(MEDIA_SUBSCRIPTIONS)) {
      expect(options).toMatchObject({
        exchange: "media.trigger",
        routingKey: `jobType.${name}`,
        queue: `media.${name}.trigger`,
      });
    }
  });

  it("runs one transcode at a time for up to 9 hours", () => {
    expect(CHANNELS.transcodeMediaChannel).toBe(1);
    expect(MEDIA_SUBSCRIPTIONS.transcode.queueOptions).toEqual({
      channel: "transcodeMediaChannel",
      arguments: { "x-consumer-timeout": 32_400_000 },
    });
  });
});
