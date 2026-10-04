import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinervaCalendarAgentClient } from "../../../src/minerva/calendars/services/MinervaCalendarAgentClient";
import { signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva";
const BLOCK_ID = "ab000000-0000-4000-8000-000000000001";
const MONDAY = "2026-10-05";

const agent = {
  listCalendars: vi.fn(),
};

const accountRow = {
  id: "ca000000-0000-4000-8000-000000000001",
  provider: "google",
  subject: "1098",
  email: "neil@example.com",
  userId: USER,
  verifiedTime: "2026-10-03T12:00:00Z",
  verificationMethod: "consent",
};

const agentCalendar = (overrides = {}) => ({
  provider: "google",
  accountLabel: "neil@example.com",
  calendarId: "neil@example.com",
  source: "work",
  synced: true,
  enablePush: false,
  enabled: true,
  syncing: false,
  includedInBusy: true,
  ...overrides,
});

const meetingRow = (overrides = {}) => ({
  id: "m-1",
  subject: "Planning",
  start_time: `${MONDAY}T10:00:00+00:00`,
  end_time: `${MONDAY}T10:30:00+00:00`,
  status: "Busy",
  source: "work",
  ...overrides,
});

const blockRow = (overrides = {}) => ({
  id: BLOCK_ID,
  startTime: `${MONDAY}T11:00:00+00:00`,
  endTime: `${MONDAY}T11:15:00+00:00`,
  status: "busy",
  label: "Focus",
  createdTime: "2026-10-04T12:00:00+00:00",
  lastUpdatedTime: "2026-10-04T12:00:00+00:00",
  ...overrides,
});

/**
 * Availability over the real HTTP stack (ADR 0029): worked out from the
 * caller's own meetings, with the blocks and meeting levels they set.
 */
describe("Availability API", () => {
  const ctx = signedInApp({
    overrides: [{ provide: MinervaCalendarAgentClient, useValue: agent }],
  });

  const owned = (rows: unknown[] = [accountRow]) =>
    ctx.t.graphql.on("ListCalendarAccounts", {
      minerva_calendar_accounts: rows,
    });

  beforeEach(() => {
    agent.listCalendars.mockReset();
    agent.listCalendars.mockResolvedValue([
      agentCalendar(),
      agentCalendar({
        calendarId: "holidays",
        source: "holidays",
        includedInBusy: false,
      }),
      agentCalendar({
        accountLabel: "theirs@example.com",
        calendarId: "theirs",
        source: "theirs",
        includedInBusy: false,
      }),
    ]);
  });

  describe("without an identity", () => {
    it.each([
      [
        "get",
        `${BASE}/availability?start=${MONDAY}T09:00:00Z&end=${MONDAY}T10:00:00Z`,
      ],
      ["get", `${BASE}/availability-blocks`],
      ["post", `${BASE}/availability-blocks`],
      ["get", `${BASE}/availability-block/${BLOCK_ID}`],
      ["put", `${BASE}/availability-block/${BLOCK_ID}`],
      ["delete", `${BASE}/availability-block/${BLOCK_ID}`],
      ["put", `${BASE}/meeting/m-1/availability`],
      ["delete", `${BASE}/meeting/m-1/availability`],
    ] as const)("%s %s answers 401 and asks no one", async (method, path) => {
      const res = await ctx.t.http()[method](path);
      expect(res.status).toBe(401);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("GetAvailability", () => {
    const get = (query: string, tz?: string) => {
      const request = ctx.t.http().get(`${BASE}/availability?${query}`);
      return ctx.as(tz ? request.set("x-ncfritz-tz", tz) : request);
    };

    it("works out the caller's slots from their meetings, levels and blocks", async () => {
      owned();
      ctx.t.graphql.on("GetAvailability", {
        minerva_meetings: [
          meetingRow(),
          meetingRow({
            id: "m-2",
            subject: "Coffee",
            start_time: `${MONDAY}T10:30:00+00:00`,
            end_time: `${MONDAY}T10:45:00+00:00`,
          }),
          meetingRow({
            id: "m-3",
            subject: "Holiday",
            start_time: `${MONDAY}T10:45:00+00:00`,
            end_time: `${MONDAY}T11:00:00+00:00`,
            source: "holidays",
          }),
        ],
        minerva_availability_blocks: [blockRow()],
      });
      ctx.t.graphql.on("ListMeetingAvailability", {
        minerva_meeting_availability: [{ meetingId: "m-2", status: "free" }],
      });

      const res = await get(
        `start=${MONDAY}T10:05:00Z&end=${MONDAY}T11:20:00Z`,
      );

      expect(res.status).toBe(200);
      const { availability } = res.body;
      expect(availability.startTime).toBe(`${MONDAY}T10:00:00.000Z`);
      expect(availability.endTime).toBe(`${MONDAY}T11:30:00.000Z`);
      expect(
        availability.slots.map((s: { status: string }) => s.status),
      ).toEqual(["busy", "busy", "free", "free", "busy", "free"]);
      expect(availability.slots[0]).toEqual({
        startTime: `${MONDAY}T10:00:00.000Z`,
        status: "busy",
      });
      expect(availability.meetings).toEqual([
        {
          meetingId: "m-1",
          subject: "Planning",
          startTime: `${MONDAY}T10:00:00.000Z`,
          endTime: `${MONDAY}T10:30:00.000Z`,
          calendarStatus: "Busy",
          status: "busy",
          overridden: false,
          counted: true,
        },
        expect.objectContaining({
          meetingId: "m-2",
          status: "free",
          overridden: true,
          counted: true,
        }),
        expect.objectContaining({ meetingId: "m-3", counted: false }),
      ]);
      expect(availability.blocks).toEqual([
        {
          id: BLOCK_ID,
          startTime: `${MONDAY}T11:00:00.000Z`,
          endTime: `${MONDAY}T11:15:00.000Z`,
          status: "busy",
          label: "Focus",
          createdTime: "2026-10-04T12:00:00.000Z",
          lastUpdatedTime: "2026-10-04T12:00:00.000Z",
        },
      ]);
      expect(ctx.t.graphql.calls("GetAvailability")[0]?.variables).toEqual({
        userId: USER,
        start: `${MONDAY}T10:00:00.000Z`,
        end: `${MONDAY}T11:30:00.000Z`,
      });
      expect(
        ctx.t.graphql.calls("ListMeetingAvailability")[0]?.variables,
      ).toEqual({ userId: USER, meetingIds: ["m-1", "m-2", "m-3"] });
    });

    it("reads the working day in the caller's time zone", async () => {
      owned();
      ctx.t.graphql.on("GetAvailability", {
        minerva_meetings: [],
        minerva_availability_blocks: [],
      });

      // 07:45 to 08:15 in Seattle (PDT).
      const res = await get(
        `start=${MONDAY}T14:45:00Z&end=${MONDAY}T15:15:00Z`,
        "America/Los_Angeles",
      );

      expect(
        res.body.availability.slots.map((s: { status: string }) => s.status),
      ).toEqual(["none", "free"]);
    });

    it("takes the working day's hours and weekends from the query", async () => {
      owned();
      ctx.t.graphql.on("GetAvailability", {
        minerva_meetings: [],
        minerva_availability_blocks: [],
      });

      const res = await get(
        "start=2026-10-04T06:45:00Z&end=2026-10-04T07:15:00Z&dayStart=07:00&dayEnd=12:00&includeWeekends=true",
      );

      expect(
        res.body.availability.slots.map((s: { status: string }) => s.status),
      ).toEqual(["none", "free"]);
    });

    it("counts every meeting when the agent cannot be reached", async () => {
      owned();
      agent.listCalendars.mockRejectedValue(new Error("down"));
      ctx.t.graphql.on("GetAvailability", {
        minerva_meetings: [meetingRow({ source: "holidays" })],
        minerva_availability_blocks: [],
      });
      ctx.t.graphql.on("ListMeetingAvailability", {
        minerva_meeting_availability: [],
      });

      const res = await get(
        `start=${MONDAY}T10:00:00Z&end=${MONDAY}T10:15:00Z`,
      );

      expect(res.status).toBe(200);
      expect(res.body.availability.slots[0].status).toBe("busy");
      expect(res.body.availability.meetings[0].counted).toBe(true);
    });

    it.each([
      ["no range", ""],
      [
        "an end before its start",
        `start=${MONDAY}T10:00:00Z&end=${MONDAY}T09:00:00Z`,
      ],
      [
        "more than 92 days",
        "start=2026-01-01T00:00:00Z&end=2026-06-01T00:00:00Z",
      ],
      [
        "a bad dayStart",
        `start=${MONDAY}T10:00:00Z&end=${MONDAY}T11:00:00Z&dayStart=8am`,
      ],
      [
        "a day that ends before it starts",
        `start=${MONDAY}T10:00:00Z&end=${MONDAY}T11:00:00Z&dayStart=18:00&dayEnd=08:00`,
      ],
      [
        "a bad includeWeekends",
        `start=${MONDAY}T10:00:00Z&end=${MONDAY}T11:00:00Z&includeWeekends=yes`,
      ],
    ])("answers 400 for %s", async (_, query) => {
      const res = await get(query);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it("answers 400 for a time zone it does not know", async () => {
      const res = await get(
        `start=${MONDAY}T10:00:00Z&end=${MONDAY}T11:00:00Z`,
        "Mars/Olympus_Mons",
      );
      expect(res.status).toBe(400);
    });
  });

  describe("ListAvailabilityBlocks", () => {
    it("lists the caller's blocks in the range", async () => {
      ctx.t.graphql.on("ListAvailabilityBlocks", {
        minerva_availability_blocks: [blockRow({ label: null })],
      });

      const res = await ctx.as(
        ctx.t
          .http()
          .get(
            `${BASE}/availability-blocks?start=${MONDAY}T00:00:00Z&end=${MONDAY}T23:59:00Z`,
          ),
      );

      expect(res.status).toBe(200);
      expect(res.body.blocks).toHaveLength(1);
      expect(res.body.blocks[0]).not.toHaveProperty("label");
      expect(
        ctx.t.graphql.calls("ListAvailabilityBlocks")[0]?.variables,
      ).toEqual({
        userId: USER,
        start: `${MONDAY}T00:00:00.000Z`,
        end: `${MONDAY}T23:59:00.000Z`,
      });
    });

    it("answers 400 without a range", async () => {
      const res = await ctx.as(ctx.t.http().get(`${BASE}/availability-blocks`));
      expect(res.status).toBe(400);
    });
  });

  describe("CreateAvailabilityBlock", () => {
    it("creates a block of the caller's and says where it is", async () => {
      ctx.t.graphql.on("CreateAvailabilityBlock", {
        insert_minerva_availability_blocks_one: blockRow(),
      });

      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/availability-blocks`)
          .send({
            block: {
              startTime: `${MONDAY}T11:00:00Z`,
              endTime: `${MONDAY}T11:15:00Z`,
              status: "busy",
              label: "  Focus ",
            },
          }),
      );

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(
        `/v1/minerva/availability-block/${BLOCK_ID}`,
      );
      expect(res.body.block.id).toBe(BLOCK_ID);
      expect(
        ctx.t.graphql.calls("CreateAvailabilityBlock")[0]?.variables,
      ).toEqual({
        block: {
          userId: USER,
          startTime: `${MONDAY}T11:00:00.000Z`,
          endTime: `${MONDAY}T11:15:00.000Z`,
          status: "busy",
          label: "Focus",
        },
      });
    });

    it("answers 400 listing every problem", async () => {
      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/availability-blocks`)
          .send({
            block: {
              startTime: `${MONDAY}T11:00:00Z`,
              endTime: `${MONDAY}T10:00:00Z`,
              status: "dnd",
              label: "x".repeat(201),
            },
          }),
      );

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain(
        "endTime must be after startTime",
      );
      expect(JSON.stringify(res.body)).toContain("status must be one of");
      expect(JSON.stringify(res.body)).toContain("label must be text");
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DescribeAvailabilityBlock", () => {
    it("describes a block of the caller's", async () => {
      ctx.t.graphql.on("DescribeAvailabilityBlock", {
        minerva_availability_blocks: [blockRow()],
      });

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/availability-block/${BLOCK_ID}`),
      );

      expect(res.status).toBe(200);
      expect(res.body.block.label).toBe("Focus");
      expect(
        ctx.t.graphql.calls("DescribeAvailabilityBlock")[0]?.variables,
      ).toEqual({ id: BLOCK_ID, userId: USER });
    });

    it("does not find another user's block", async () => {
      ctx.t.graphql.on("DescribeAvailabilityBlock", {
        minerva_availability_blocks: [],
      });

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/availability-block/${BLOCK_ID}`),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("UpdateAvailabilityBlock", () => {
    const put = (block: unknown) =>
      ctx.as(
        ctx.t
          .http()
          .put(`${BASE}/availability-block/${BLOCK_ID}`)
          .send({ block }),
      );

    it("changes only what the request names", async () => {
      ctx.t.graphql.on("DescribeAvailabilityBlock", {
        minerva_availability_blocks: [blockRow()],
      });
      ctx.t.graphql.on("UpdateAvailabilityBlock", {
        update_minerva_availability_blocks: {
          returning: [
            blockRow({ endTime: `${MONDAY}T12:00:00+00:00`, label: null }),
          ],
        },
      });

      const res = await put({ endTime: `${MONDAY}T12:00:00Z`, label: null });

      expect(res.status).toBe(200);
      expect(res.body.block.endTime).toBe(`${MONDAY}T12:00:00.000Z`);
      expect(
        ctx.t.graphql.calls("UpdateAvailabilityBlock")[0]?.variables,
      ).toEqual({
        id: BLOCK_ID,
        userId: USER,
        set: { endTime: `${MONDAY}T12:00:00.000Z`, label: null },
      });
    });

    it("refuses a move that would end it before it starts", async () => {
      ctx.t.graphql.on("DescribeAvailabilityBlock", {
        minerva_availability_blocks: [blockRow()],
      });

      const res = await put({ endTime: `${MONDAY}T10:00:00Z` });

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("UpdateAvailabilityBlock")).toHaveLength(0);
    });

    it("answers 304 when the request names nothing", async () => {
      const res = await put({});
      expect(res.status).toBe(304);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it("does not find another user's block", async () => {
      ctx.t.graphql.on("DescribeAvailabilityBlock", {
        minerva_availability_blocks: [],
      });

      const res = await put({ status: "free" });

      expect(res.status).toBe(404);
    });
  });

  describe("DeleteAvailabilityBlock", () => {
    it("deletes a block of the caller's", async () => {
      ctx.t.graphql.on("DeleteAvailabilityBlock", {
        delete_minerva_availability_blocks: { affected_rows: 1 },
      });

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/availability-block/${BLOCK_ID}`),
      );

      expect(res.status).toBe(204);
      expect(
        ctx.t.graphql.calls("DeleteAvailabilityBlock")[0]?.variables,
      ).toEqual({ id: BLOCK_ID, userId: USER });
    });

    it("does not find another user's block", async () => {
      ctx.t.graphql.on("DeleteAvailabilityBlock", {
        delete_minerva_availability_blocks: { affected_rows: 0 },
      });

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/availability-block/${BLOCK_ID}`),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("SetMeetingAvailability", () => {
    const put = (body: object) =>
      ctx.as(ctx.t.http().put(`${BASE}/meeting/m-1/availability`).send(body));

    it("sets the level of one of the caller's meetings", async () => {
      owned();
      ctx.t.graphql.on("DescribeMeetingForAvailability", {
        minerva_meetings: [meetingRow()],
      });
      ctx.t.graphql.on("SetMeetingAvailability", {
        insert_minerva_meeting_availability_one: { meetingId: "m-1" },
      });

      const res = await put({ availability: { status: "interruptable" } });

      expect(res.status).toBe(200);
      expect(res.body.meeting).toEqual(
        expect.objectContaining({
          meetingId: "m-1",
          calendarStatus: "Busy",
          status: "interruptable",
          overridden: true,
          counted: true,
        }),
      );
      expect(
        ctx.t.graphql.calls("DescribeMeetingForAvailability")[0]?.variables,
      ).toEqual({ id: "m-1", userId: USER });
      expect(
        ctx.t.graphql.calls("SetMeetingAvailability")[0]?.variables,
      ).toEqual({
        availability: {
          userId: USER,
          meetingId: "m-1",
          status: "interruptable",
        },
      });
    });

    it("does not find another user's meeting", async () => {
      ctx.t.graphql.on("DescribeMeetingForAvailability", {
        minerva_meetings: [],
      });

      const res = await put({ availability: { status: "free" } });

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("SetMeetingAvailability")).toHaveLength(0);
    });

    it("answers 400 for a level it does not know", async () => {
      const res = await put({ availability: { status: "dnd" } });
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("ClearMeetingAvailability", () => {
    it("clears the caller's level, set or not", async () => {
      ctx.t.graphql.on("ClearMeetingAvailability", {
        delete_minerva_meeting_availability: { affected_rows: 0 },
      });

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/meeting/m-1/availability`),
      );

      expect(res.status).toBe(204);
      expect(
        ctx.t.graphql.calls("ClearMeetingAvailability")[0]?.variables,
      ).toEqual({ userId: USER, meetingId: "m-1" });
    });
  });
});
