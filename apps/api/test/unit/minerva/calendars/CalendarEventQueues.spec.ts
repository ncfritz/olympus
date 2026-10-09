import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { describe, expect, it, vi } from "vitest";
import { CalendarEventQueues } from "../../../../src/minerva/calendars/services/CalendarEventQueues";

const DEAD = "olympus-api.calendar-events.dead";

const delivery = (
  headers: Record<string, unknown> | undefined,
  routingKey = DEAD,
) => ({
  content: Buffer.from(JSON.stringify({ id: "work:abc" })),
  fields: { routingKey },
  properties: { headers },
});

const queuesWith = (got: unknown) => {
  const channel = {
    get: vi.fn().mockResolvedValue(got),
    ack: vi.fn(),
    nack: vi.fn(),
    checkQueue: vi.fn().mockResolvedValue({ messageCount: 3 }),
  };
  const amqp = { channel, publish: vi.fn() } as unknown as AmqpConnection;
  return { queues: new CalendarEventQueues(amqp), channel, amqp };
};

describe("CalendarEventQueues", () => {
  it("keeps the routing key the consumer recorded", async () => {
    const { queues } = queuesWith(
      delivery({ "x-olympus-routing-key": "event.delete" }),
    );

    const dead = await queues.takeDead();

    expect(dead?.message).toEqual({ id: "work:abc" });
    expect(dead?.headers["x-olympus-routing-key"]).toBe("event.delete");
  });

  it("finds the first routing key of a message RabbitMQ dead-lettered", async () => {
    // x-death lists the most recent death first.
    const { queues } = queuesWith(
      delivery({
        "x-death": [
          { queue: "olympus-api.calendar-events", "routing-keys": [DEAD] },
          {
            queue: "olympus-api.calendar-events",
            "routing-keys": ["event.backfill"],
          },
        ],
      }),
    );

    const dead = await queues.takeDead();

    expect(dead?.headers["x-olympus-routing-key"]).toBe("event.backfill");
  });

  it("settles what it took, and nothing when the queue is empty", async () => {
    const taken = delivery({});
    const { queues, channel } = queuesWith(taken);

    const dead = await queues.takeDead();
    dead?.release();
    dead?.ack();

    expect(channel.get).toHaveBeenCalledWith(DEAD, { noAck: false });
    expect(channel.nack).toHaveBeenCalledWith(taken, false, true);
    expect(channel.ack).toHaveBeenCalledWith(taken);
    expect(await queuesWith(false).queues.takeDead()).toBeUndefined();
  });

  it("sends persistently through the default exchange", async () => {
    const { queues, amqp } = queuesWith(false);

    await queues.send("q", { id: 1 }, { a: 1 });

    expect(amqp.publish).toHaveBeenCalledWith(
      "",
      "q",
      { id: 1 },
      { headers: { a: 1 }, persistent: true, contentType: "application/json" },
    );
    expect(await queues.countDead()).toBe(3);
  });
});
