import { Nack } from "@golevelup/nestjs-rabbitmq";
import type { ConsumeMessage } from "amqplib";
import { register } from "prom-client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { CalendarEventHandler } from "../../../src/minerva/calendars/handlers/CalendarEventHandler";
import { calendarEvent } from "../../fixtures/calendarEvents";
import { uniqueViolation, USER } from "../../support/signedInApp";
import { createTestApp, type TestApp } from "../../support/testApp";

const ACCOUNT_ID = "ca000000-0000-4000-8000-000000000001";

const delivery = (routingKey: string) =>
  ({ fields: { routingKey } }) as unknown as ConsumeMessage;

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
  let waits: number[];

  beforeAll(async () => {
    t = await createTestApp();
    handler = t.app.get(CalendarEventHandler);
  });
  afterAll(async () => t.close());
  beforeEach(() => {
    t.reset();
    waits = [];
    vi.spyOn(
      handler as unknown as { wait: (ms: number) => Promise<void> },
      "wait",
    ).mockImplementation(async (ms) => {
      waits.push(ms);
    });
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

  it("dead-letters a malformed event", async () => {
    const before = await consumed("upsert", "invalid");

    const result = await handler.handle(
      calendarEvent({ startTime: "soon" }),
      delivery("event.upsert"),
    );

    expect(result).toEqual(new Nack(false));
    expect(t.graphql.request).not.toHaveBeenCalled();
    expect(await consumed("upsert", "invalid")).toBe(before + 1);
  });

  it("dead-letters a message with an unknown routing key", async () => {
    const result = await handler.handle(
      calendarEvent(),
      delivery("event.rename"),
    );

    expect(result).toEqual(new Nack(false));
    expect(t.graphql.request).not.toHaveBeenCalled();
  });

  it("dead-letters an event Hasura refuses for its data", async () => {
    owned(true);
    t.graphql.on("WriteCalendarEvent", uniqueViolation);

    const result = await handler.handle(
      calendarEvent(),
      delivery("event.upsert"),
    );

    expect(result).toEqual(new Nack(false));
    expect(waits).toEqual([]);
  });

  it("requeues while Hasura does not answer, waiting longer each time", async () => {
    t.graphql.fail("DescribeCalendarEventOwner", "fetch failed");
    const before = await consumed("upsert", "failed");

    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(
        await handler.handle(calendarEvent(), delivery("event.upsert")),
      );
    }

    expect(results).toEqual(Array(6).fill(new Nack(true)));
    expect(waits).toEqual([5_000, 10_000, 20_000, 40_000, 60_000, 60_000]);
    expect(await consumed("upsert", "failed")).toBe(before + 6);

    // Once Hasura answers, the waits start over.
    owned(true);
    written();
    await handler.handle(calendarEvent(), delivery("event.upsert"));
    t.graphql.fail("WriteCalendarEvent", "fetch failed");
    await handler.handle(calendarEvent(), delivery("event.upsert"));
    expect(waits.at(-1)).toBe(5_000);
  });
});
