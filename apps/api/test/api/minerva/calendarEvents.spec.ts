import type { ConsumeMessage } from "amqplib";
import { register } from "prom-client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CalendarEventHandler } from "../../../src/minerva/calendars/handlers/CalendarEventHandler";
import { calendarEvent } from "../../fixtures/calendarEvents";
import { uniqueViolation, USER } from "../../support/signedInApp";
import { createTestApp, type TestApp } from "../../support/testApp";

const ACCOUNT_ID = "ca000000-0000-4000-8000-000000000001";

const QUEUE = "olympus-api.calendar-events";
const DEAD = `${QUEUE}.dead`;

const delivery = (routingKey: string, headers: Record<string, unknown> = {}) =>
  ({
    fields: { routingKey },
    properties: { headers },
  }) as unknown as ConsumeMessage;

/** How many events the counter has seen with these labels. */
const consumed = async (action: string, result: string): Promise<number> => {
  const metric = register.getSingleMetric("calendar_events_consumed_total");
  const values = (await metric?.get())?.values ?? [];
  return (
    values.find((v) => v.labels.action === action && v.labels.result === result)
      ?.value ?? 0
  );
};

/**
 * The consumer of the calendar sync agent's events (ADR 0028), its handler
 * called as RabbitMQ would call it, against the API's Hasura stand-in.
 */
describe("Calendar events consumer", () => {
  let t: TestApp;
  let handler: CalendarEventHandler;

  beforeAll(async () => {
    t = await createTestApp();
    handler = t.app.get(CalendarEventHandler);
  });
  afterAll(async () => t.close());
  beforeEach(() => {
    t.reset();
  });

  /** Where the handler sent messages: [queue, message, headers]. */
  const sent = () =>
    t.amqp.publish.mock.calls.map(([exchange, queue, message, options]) => {
      expect(exchange).toBe("");
      expect(options).toMatchObject({ persistent: true });
      return [
        queue,
        message,
        (options as { headers: Record<string, unknown> }).headers,
      ];
    });

  const owned = (owner: boolean) =>
    t.graphql.on("DescribeCalendarEventOwner", {
      minerva_calendar_accounts: owner
        ? [{ id: ACCOUNT_ID, userId: USER }]
        : [],
    });
  const written = () =>
    t.graphql.on("WriteCalendarEvent", {
      insert_minerva_meetings_one: { id: calendarEvent().id },
    });

  it("subscribes to every action on its own queue, with a dead-letter queue", () => {
    const handle = CalendarEventHandler.prototype.handle;
    const config = Reflect.getMetadataKeys(handle)
      .map((key) => Reflect.getMetadata(key, handle))
      .find((value) => value && typeof value === "object" && "queue" in value);
    expect(config).toMatchObject({
      type: "subscribe",
      exchange: "calendar.events",
      routingKey: "event.*",
      queue: "olympus-api.calendar-events",
      queueOptions: {
        durable: true,
        channel: "calendarEventsChannel",
        deadLetterExchange: "",
        deadLetterRoutingKey: "olympus-api.calendar-events.dead",
      },
      // What the handler does not catch is dead-lettered, never requeued.
      errorBehavior: "NACK",
    });
  });

  it("writes an owned event as the account's user's meeting", async () => {
    owned(true);
    written();
    const before = await consumed("upsert", "written");

    const result = await handler.handle(
      calendarEvent(),
      delivery("event.upsert"),
    );

    expect(result).toBeUndefined();
    expect(t.graphql.calls("DescribeCalendarEventOwner")[0]?.variables).toEqual(
      { provider: "google", subject: "1098" },
    );
    const write = t.graphql.calls("WriteCalendarEvent")[0];
    expect(write?.variables).toEqual({
      meeting: expect.objectContaining({
        id: "neil:abc123@google.com",
        status: "Busy",
        deleted: false,
        user_id: USER,
        account_id: ACCOUNT_ID,
      }),
    });
    // An upsert by ID that rewrites every column the event sets, owner
    // and account included.
    expect(write?.document).toContain("constraint: meetings_pkey");
    for (const column of ["start_time", "deleted", "user_id", "account_id"]) {
      expect(write?.document).toMatch(
        new RegExp(`update_columns: \\[[^\\]]*\\b${column}\\b`),
      );
    }
    expect(await consumed("upsert", "written")).toBe(before + 1);
  });

  it("writes a backfilled event the same way", async () => {
    owned(true);
    written();

    await handler.handle(calendarEvent(), delivery("event.backfill"));

    expect(t.graphql.calls("WriteCalendarEvent")).toHaveLength(1);
  });

  it("writes a delete as the meeting marked deleted", async () => {
    owned(true);
    written();

    await handler.handle(
      calendarEvent({ deleted: true }),
      delivery("event.delete"),
    );

    expect(
      t.graphql.calls("WriteCalendarEvent")[0]?.variables?.meeting,
    ).toMatchObject({ deleted: true });
  });

  it("writes a repeated message to the same row with the same values", async () => {
    owned(true);
    written();

    await handler.handle(calendarEvent(), delivery("event.upsert"));
    await handler.handle(calendarEvent(), delivery("event.upsert"));

    const [first, second] = t.graphql.calls("WriteCalendarEvent");
    expect(second?.variables).toEqual(first?.variables);
    expect(second?.document).toBe(first?.document);
  });

  it("acknowledges, and does not write, an event of an account no user owns", async () => {
    owned(false);
    const before = await consumed("upsert", "unowned");

    const result = await handler.handle(
      calendarEvent(),
      delivery("event.upsert"),
    );

    expect(result).toBeUndefined();
    expect(t.graphql.calls("WriteCalendarEvent")).toHaveLength(0);
    expect(await consumed("upsert", "unowned")).toBe(before + 1);
  });

  it("acknowledges, without asking anyone, an event that names no account", async () => {
    const result = await handler.handle(
      calendarEvent({ account: undefined }),
      delivery("event.upsert"),
    );

    expect(result).toBeUndefined();
    expect(t.graphql.request).not.toHaveBeenCalled();
  });

  it("dead-letters a malformed event with why", async () => {
    const before = await consumed("upsert", "invalid");
    const event = calendarEvent({ startTime: "soon" });

    const result = await handler.handle(event, delivery("event.upsert"));

    expect(result).toBeUndefined();
    expect(t.graphql.request).not.toHaveBeenCalled();
    expect(sent()).toEqual([
      [
        DEAD,
        event,
        {
          "x-olympus-attempts": 0,
          "x-olympus-routing-key": "event.upsert",
          "x-olympus-dead-reason": expect.stringMatching(/startTime/),
          "x-olympus-dead-at": expect.any(String),
        },
      ],
    ]);
    expect(await consumed("upsert", "invalid")).toBe(before + 1);
  });

  it("dead-letters a message with an unknown routing key", async () => {
    const result = await handler.handle(
      calendarEvent(),
      delivery("event.rename"),
    );

    expect(result).toBeUndefined();
    expect(t.graphql.request).not.toHaveBeenCalled();
    expect(sent()[0]?.[0]).toBe(DEAD);
    expect(sent()[0]?.[2]).toMatchObject({
      "x-olympus-dead-reason": "unknown routing key event.rename",
    });
  });

  it("dead-letters an event Hasura refuses for its data, without retrying", async () => {
    owned(true);
    t.graphql.on("WriteCalendarEvent", uniqueViolation);

    await handler.handle(calendarEvent(), delivery("event.upsert"));

    expect(sent().map(([queue]) => queue)).toEqual([DEAD]);
    expect(sent()[0]?.[2]).toMatchObject({
      "x-olympus-dead-reason": expect.stringMatching(/^Hasura refused it/),
    });
  });

  it("retries through the delay queues while Hasura does not answer, counting", async () => {
    t.graphql.fail("DescribeCalendarEventOwner", "fetch failed");
    const event = calendarEvent();
    const before = await consumed("upsert", "retried");

    // As the event comes back from each delay queue: through the events
    // queue, its first routing key and its count in the headers.
    const queues = [];
    for (let failed = 0; failed < 9; failed++) {
      t.amqp.publish.mockClear();
      const headers =
        failed === 0
          ? {}
          : {
              "x-olympus-attempts": failed,
              "x-olympus-routing-key": "event.upsert",
            };
      await handler.handle(
        event,
        delivery(failed === 0 ? "event.upsert" : QUEUE, headers),
      );
      const [[queue, message, sentHeaders]] = sent();
      expect(message).toEqual(event);
      expect(sentHeaders).toMatchObject({
        "x-olympus-attempts": failed + 1,
        "x-olympus-routing-key": "event.upsert",
      });
      queues.push(queue);
    }

    expect(queues).toEqual([
      `${QUEUE}.retry.5s`,
      `${QUEUE}.retry.5s`,
      `${QUEUE}.retry.30s`,
      `${QUEUE}.retry.30s`,
      `${QUEUE}.retry.30s`,
      `${QUEUE}.retry.5m`,
      `${QUEUE}.retry.5m`,
      `${QUEUE}.retry.5m`,
      `${QUEUE}.retry.5m`,
    ]);
    expect(await consumed("upsert", "retried")).toBe(before + 9);
  });

  it("dead-letters an event on its tenth failure", async () => {
    t.graphql.fail("DescribeCalendarEventOwner", "fetch failed");
    const before = await consumed("backfill", "gave_up");

    await handler.handle(
      calendarEvent(),
      delivery(QUEUE, {
        "x-olympus-attempts": 9,
        "x-olympus-routing-key": "event.backfill",
      }),
    );

    expect(sent()).toEqual([
      [
        DEAD,
        calendarEvent(),
        expect.objectContaining({
          "x-olympus-attempts": 10,
          "x-olympus-routing-key": "event.backfill",
          "x-olympus-dead-reason": expect.stringMatching(
            /^gave up after 10 attempts: .*fetch failed/,
          ),
        }),
      ],
    ]);
    expect(await consumed("backfill", "gave_up")).toBe(before + 1);
  });

  it("writes an event that came back from a delay queue, by its first routing key", async () => {
    owned(true);
    written();

    await handler.handle(
      calendarEvent(),
      delivery(QUEUE, {
        "x-olympus-attempts": 3,
        "x-olympus-routing-key": "event.delete",
      }),
    );

    expect(t.graphql.calls("WriteCalendarEvent")).toHaveLength(1);
    expect(sent()).toEqual([]);
  });
});
