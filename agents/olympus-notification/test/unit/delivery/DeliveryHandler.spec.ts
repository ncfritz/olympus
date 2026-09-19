import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import moment from "moment";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryHandler } from "../../../src/delivery/DeliveryHandler";
import type { NotificationEvent } from "../../../src/delivery/events";
import type { NotificationFormatter } from "../../../src/delivery/NotificationFormatter";
import { baseEvent } from "../../fixtures/events";

type Event = NotificationEvent<NotificationContext>;

class TestHandler extends DeliveryHandler<Event, string> {
  readonly sent: [Event, string][] = [];
  formatter?: NotificationFormatter<Event, string>;
  failSend = false;

  get channelName() {
    return "test";
  }

  run(notification: Event) {
    return this.deliver(notification);
  }

  protected formatterFor() {
    return this.formatter;
  }

  protected async send(notification: Event, payload: string) {
    if (this.failSend) throw new Error("transport down");
    this.sent.push([notification, payload]);
  }
}

describe("DeliveryHandler", () => {
  let handler: TestHandler;
  const format = vi.fn(async (n: Event) => `formatted ${n.eventId}`);

  beforeEach(() => {
    handler = new TestHandler();
    handler.formatter = { formatNotification: format };
    format.mockClear();
  });

  it("formats and sends", async () => {
    const event = baseEvent();
    await handler.run(event);
    expect(handler.sent).toEqual([[event, "formatted event-1"]]);
  });

  it("sends when there is no expiration time", async () => {
    await handler.run(baseEvent({ expirationTime: undefined }));
    expect(handler.sent).toHaveLength(1);
  });

  it("drops expired notifications", async () => {
    await handler.run(baseEvent({ expirationTime: "2000-01-01T00:00:00Z" }));
    expect(format).not.toHaveBeenCalled();
    expect(handler.sent).toEqual([]);
  });

  it("drops notifications with an invalid expiration time", async () => {
    // moment warns before falling back to Date for unparseable input.
    moment.suppressDeprecationWarnings = true;
    await handler.run(baseEvent({ expirationTime: "next tuesday" }));
    expect(handler.sent).toEqual([]);
  });

  it("ignores notification types the channel has no formatter for", async () => {
    handler.formatter = undefined;
    await handler.run(baseEvent());
    expect(handler.sent).toEqual([]);
  });

  it("logs, and does not throw, when formatting or sending fails", async () => {
    format.mockRejectedValueOnce(new Error("bad template"));
    await expect(handler.run(baseEvent())).resolves.toBeUndefined();
    handler.failSend = true;
    await expect(handler.run(baseEvent())).resolves.toBeUndefined();
  });
});
