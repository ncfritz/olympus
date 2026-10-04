import { beforeEach, describe, expect, it } from "vitest";
import {
  CalendarEventQueues,
  type DeadCalendarEvent,
} from "../../../src/minerva/calendars/services/CalendarEventQueues";
import { calendarEvent } from "../../fixtures/calendarEvents";
import { signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva/calendar-events/dead-letters";
const QUEUE = "olympus-api.calendar-events";

type Stored = { message: unknown; headers: Record<string, unknown> };

/**
 * The dead-letter queue as a list: taking moves a message out until it is
 * acknowledged (gone) or released (back where it was, at the front).
 */
class FakeQueues {
  dead: Stored[] = [];
  sent: [string, unknown, Record<string, unknown>][] = [];
  /** Messages that arrive in the dead-letter queue while a redrive runs. */
  onSend?: () => void;

  async send(
    queue: string,
    message: unknown,
    headers: Record<string, unknown>,
  ) {
    this.sent.push([queue, message, headers]);
    this.onSend?.();
  }

  async countDead() {
    return this.dead.length;
  }

  async takeDead(): Promise<DeadCalendarEvent | undefined> {
    const stored = this.dead.shift();
    if (!stored) return undefined;
    return {
      ...stored,
      ack: () => {},
      release: () => {
        this.dead.unshift(stored);
      },
    };
  }
}

const deadHeaders = (over: Record<string, unknown> = {}) => ({
  "x-olympus-attempts": 10,
  "x-olympus-routing-key": "event.upsert",
  "x-olympus-dead-reason": "gave up after 10 attempts: fetch failed",
  "x-olympus-dead-at": "2026-10-04T20:24:14.751Z",
  ...over,
});

/**
 * The calendar events' dead-letter queue (ADR 0028, amended): what waits,
 * and putting it back. Both are for admins.
 */
describe("Calendar event dead letters API", () => {
  const queues = new FakeQueues();
  const ctx = signedInApp({
    env: { AUTH_MODE_USERS: "enforce" },
    overrides: [{ provide: CalendarEventQueues, useValue: queues }],
  });

  beforeEach(async () => {
    queues.dead = [];
    queues.sent = [];
    queues.onSend = undefined;
    await ctx.signInAs(USER, ["user", "admin"]);
  });

  it.each([
    ["get", BASE],
    ["post", `${BASE}/redrive`],
  ] as const)("%s %s is for admins", async (method, path) => {
    await ctx.signInAs(USER, ["user"]);
    expect((await ctx.as(ctx.t.http()[method](path))).status).toBe(403);
    expect((await ctx.t.http()[method](path)).status).toBe(401);
  });

  describe("DescribeCalendarEventDeadLetters", () => {
    it("counts what waits and describes the first, leaving them where they were", async () => {
      queues.dead = [
        { message: calendarEvent(), headers: deadHeaders() },
        {
          message: calendarEvent({ startTime: "soon" }),
          headers: deadHeaders({
            "x-olympus-attempts": 0,
            "x-olympus-routing-key": "event.backfill",
            "x-olympus-dead-reason": "startTime must be a timestamp",
          }),
        },
        // Rejected by RabbitMQ rather than sent by the consumer: no reason.
        {
          message: { id: "x:1" },
          headers: { "x-olympus-routing-key": "event.delete" },
        },
      ];
      const before = [...queues.dead];

      const res = await ctx.as(ctx.t.http().get(BASE));

      expect(res.status).toBe(200);
      expect(res.body.deadLetters).toEqual({
        count: 3,
        sample: [
          {
            eventId: "neil:abc123@google.com",
            action: "upsert",
            attempts: 10,
            reason: "gave up after 10 attempts: fetch failed",
            deadTime: "2026-10-04T20:24:14.751Z",
          },
          {
            eventId: "neil:abc123@google.com",
            action: "backfill",
            attempts: 0,
            reason: "startTime must be a timestamp",
            deadTime: "2026-10-04T20:24:14.751Z",
          },
          { eventId: "x:1", action: "delete", attempts: 0 },
        ],
      });
      expect(queues.dead).toEqual(before);
      expect(queues.sent).toEqual([]);
    });

    it("describes at most twenty", async () => {
      queues.dead = Array.from({ length: 25 }, (_, i) => ({
        message: { id: `x:${i}` },
        headers: deadHeaders(),
      }));

      const res = await ctx.as(ctx.t.http().get(BASE));

      expect(res.body.deadLetters.count).toBe(25);
      expect(res.body.deadLetters.sample).toHaveLength(20);
      expect(queues.dead).toHaveLength(25);
    });
  });

  describe("RedriveCalendarEventDeadLetters", () => {
    it("puts each back on the events queue as first published, attempts from nought", async () => {
      queues.dead = [
        { message: calendarEvent(), headers: deadHeaders() },
        {
          message: { id: "x:1" },
          headers: deadHeaders({ "x-olympus-routing-key": "event.delete" }),
        },
      ];

      const res = await ctx.as(ctx.t.http().post(`${BASE}/redrive`));

      expect(res.status).toBe(200);
      expect(res.body.redrive).toEqual({ redriven: 2, remaining: 0 });
      expect(queues.sent).toEqual([
        [QUEUE, calendarEvent(), { "x-olympus-routing-key": "event.upsert" }],
        [QUEUE, { id: "x:1" }, { "x-olympus-routing-key": "event.delete" }],
      ]);
      expect(queues.dead).toEqual([]);
    });

    it("leaves what arrives during the redrive for the next one", async () => {
      queues.dead = [
        { message: { id: "x:1" }, headers: deadHeaders() },
        { message: { id: "x:2" }, headers: deadHeaders() },
      ];
      // Each one fails again at once and comes straight back.
      queues.onSend = () => {
        const [, message] = queues.sent.at(-1)!;
        queues.dead.push({ message, headers: deadHeaders() });
      };

      const res = await ctx.as(ctx.t.http().post(`${BASE}/redrive`));

      expect(res.body.redrive).toEqual({ redriven: 2, remaining: 2 });
      expect(queues.sent).toHaveLength(2);
    });

    it("keeps a dead letter it could not send", async () => {
      queues.dead = [{ message: { id: "x:1" }, headers: deadHeaders() }];
      queues.send = async () => {
        throw new Error("channel closed");
      };

      const res = await ctx.as(ctx.t.http().post(`${BASE}/redrive`));

      expect(res.status).toBe(500);
      expect(queues.dead).toHaveLength(1);
      delete (queues as Partial<FakeQueues>).send;
    });
  });
});
