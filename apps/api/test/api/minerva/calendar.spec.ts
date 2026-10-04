import moment from "moment";
import { describe, expect, it } from "vitest";
import { graphQlMeeting } from "../../fixtures/minerva";
import { OTHER_USER, signedInApp, USER } from "../../support/signedInApp";

/**
 * The calendar operations over the real HTTP stack. Every item belongs to a
 * user (ADR 0028): each operation needs an identity and asks Hasura only
 * for the caller's rows.
 */
describe("Minerva calendar API", () => {
  const ctx = signedInApp();
  const t = () => ctx.t;

  describe("without an identity", () => {
    it.each([
      ["post", "/v1/minerva/meetings"],
      ["get", "/v1/minerva/meeting/meeting-1"],
      ["put", "/v1/minerva/meeting/meeting-1"],
      ["delete", "/v1/minerva/meeting/meeting-1"],
      ["get", "/v1/minerva/meetings/2026-09-18"],
      ["get", "/v1/minerva/meeting/meeting-1/next"],
      ["get", "/v1/minerva/meeting/meeting-1/previous"],
      ["get", "/v1/minerva/meetings/statistics/2026-09-14?days=6"],
      ["get", "/v1/minerva/meetings/summary/2026-09-14?days=2"],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await t().http()[method](path);
        expect(res.status).toBe(401);
        expect(t().graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("POST /v1/minerva/meetings (CreateCalendarItem)", () => {
    const item = {
      id: "meeting-1",
      uid: "uid-1",
      subject: "Planning",
      startTime: "2026-09-18T16:00:00Z",
      endTime: "2026-09-18T17:30:00Z",
      duration: 90,
      isAllDay: false,
      isCancelled: false,
      organizer: {
        email: "lead@example.com",
        alias: "lead",
        givenName: "Lee",
        surname: "Dar",
        type: "Required",
      },
      attendees: [
        {
          email: "ncfritz@example.com",
          alias: "ncfritz",
          givenName: "Neil",
          surname: "Fritz",
          type: "Required",
          attendance: "Required",
          response: "Accepted",
        },
        {
          email: "lead@example.com",
          alias: "lead",
          givenName: "Lee",
          surname: "Dar",
          type: "Required",
          attendance: "Organizer",
          response: "Accepted",
        },
      ],
    };

    it("upserts the caller's meeting, its people and its attendees", async () => {
      t()
        .graphql.on("GetCalendarItemOwner", { minerva_meetings_by_pk: null })
        .on("CreateMeeting", {
          insert_minerva_meeting_user: { affected_rows: 2 },
          insert_minerva_meetings_one: { id: "meeting-1" },
          insert_minerva_meeting_attendees: { affected_rows: 2 },
        })
        .on("DescribeCalendarItem", { minerva_meetings: [graphQlMeeting()] });

      const res = await ctx.as(
        t().http().post("/v1/minerva/meetings").send({ item }),
      );

      expect(res.status).toBe(201);
      expect(res.body.item).toMatchObject({ id: "meeting-1", duration: 90 });
      expect(res.headers.location).toBe("/v1/minerva/meeting/meeting-1");
      const variables = t().graphql.calls("CreateMeeting")[0].variables!;
      expect(variables.user_id).toBe(USER);
      expect(variables.meeting).toMatchObject({
        id: "meeting-1",
        user_id: USER,
        all_day: false,
        deleted: false,
        organizer_email: "lead@example.com",
      });
      // The organizer is also an attendee: one row for them.
      expect(variables.people).toEqual([
        expect.objectContaining({
          user_id: USER,
          email: "lead@example.com",
          given_name: "Lee",
        }),
        expect.objectContaining({
          user_id: USER,
          email: "ncfritz@example.com",
          given_name: "Neil",
        }),
      ]);
      expect(variables.attendees).toEqual([
        {
          user_id: USER,
          meeting_id: "meeting-1",
          attendee_email: "ncfritz@example.com",
          attendance: "Required",
          response: "Accepted",
        },
        {
          user_id: USER,
          meeting_id: "meeting-1",
          attendee_email: "lead@example.com",
          attendance: "Organizer",
          response: "Accepted",
        },
      ]);
      expect(t().graphql.calls("DescribeCalendarItem")[0].variables).toEqual({
        id: "meeting-1",
        user_id: USER,
      });
    });

    it("answers 409 for an ID that is another user's meeting, writing nothing", async () => {
      t().graphql.on("GetCalendarItemOwner", {
        minerva_meetings_by_pk: { user_id: OTHER_USER },
      });

      const res = await ctx.as(
        t().http().post("/v1/minerva/meetings").send({ item }),
      );

      expect(res.status).toBe(409);
      expect(t().graphql.calls("CreateMeeting")).toHaveLength(0);
    });

    it("answers 409 when the upsert finds another user's row after all", async () => {
      t()
        .graphql.on("GetCalendarItemOwner", { minerva_meetings_by_pk: null })
        .on("CreateMeeting", {
          insert_minerva_meeting_user: { affected_rows: 2 },
          insert_minerva_meetings_one: null,
          insert_minerva_meeting_attendees: { affected_rows: 0 },
        });

      const res = await ctx.as(
        t().http().post("/v1/minerva/meetings").send({ item }),
      );

      expect(res.status).toBe(409);
    });
  });

  describe("GET /v1/minerva/meeting/:meetingId (DescribeCalendarItem)", () => {
    it("returns the caller's meeting", async () => {
      t().graphql.on("DescribeCalendarItem", {
        minerva_meetings: [graphQlMeeting()],
      });

      const res = await ctx.as(t().http().get("/v1/minerva/meeting/meeting-1"));

      expect(res.status).toBe(200);
      expect(res.body.item).toMatchObject({
        id: "meeting-1",
        startTime: "2026-09-18T16:00:00.000Z",
      });
      expect(t().graphql.calls("DescribeCalendarItem")[0].variables).toEqual({
        id: "meeting-1",
        user_id: USER,
      });
    });

    it("answers 404 for an unknown meeting or another user's", async () => {
      await ctx.signInAs(OTHER_USER);
      t().graphql.on("DescribeCalendarItem", { minerva_meetings: [] });

      const res = await ctx.as(t().http().get("/v1/minerva/meeting/meeting-1"));

      expect(res.status).toBe(404);
      expect(t().graphql.calls("DescribeCalendarItem")[0].variables).toEqual({
        id: "meeting-1",
        user_id: OTHER_USER,
      });
    });
  });

  describe("PUT /v1/minerva/meeting/:meetingId (UpdateCalendarItem)", () => {
    it("applies the changes to the caller's meeting", async () => {
      t().graphql.on("UpdateMeeting", {
        update_minerva_meetings: {
          returning: [graphQlMeeting({ subject: "Renamed" })],
        },
      });

      const res = await ctx.as(
        t()
          .http()
          .put("/v1/minerva/meeting/meeting-1")
          .send({ item: { subject: "Renamed" } }),
      );

      expect(res.status).toBe(200);
      expect(res.body.item.subject).toBe("Renamed");
      expect(t().graphql.calls("UpdateMeeting")[0].variables).toEqual({
        id: "meeting-1",
        user_id: USER,
        changes: { subject: "Renamed" },
      });
    });

    it("never changes the meeting's ID or owner", async () => {
      t().graphql.on("UpdateMeeting", {
        update_minerva_meetings: { returning: [graphQlMeeting()] },
      });

      await ctx.as(
        t()
          .http()
          .put("/v1/minerva/meeting/meeting-1")
          .send({
            item: {
              subject: "Mine now",
              id: "other",
              user_id: OTHER_USER,
              userId: OTHER_USER,
              account_id: OTHER_USER,
            },
          }),
      );

      expect(t().graphql.calls("UpdateMeeting")[0].variables).toMatchObject({
        changes: { subject: "Mine now" },
      });
    });

    it("answers 304 without touching Hasura for an empty change set", async () => {
      const res = await ctx.as(
        t().http().put("/v1/minerva/meeting/meeting-1").send({ item: {} }),
      );

      expect(res.status).toBe(304);
      expect(t().graphql.request).not.toHaveBeenCalled();
    });

    it("answers 404 for an unknown meeting or another user's", async () => {
      t().graphql.on("UpdateMeeting", {
        update_minerva_meetings: { returning: [] },
      });

      const res = await ctx.as(
        t()
          .http()
          .put("/v1/minerva/meeting/nope")
          .send({ item: { subject: "x" } }),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /v1/minerva/meeting/:meetingId (DeleteCalendarItem)", () => {
    it("marks the caller's meeting deleted", async () => {
      t().graphql.on("DeleteCalendarItem", {
        update_minerva_meetings: {
          returning: [graphQlMeeting({ deleted: true })],
        },
      });

      const res = await ctx.as(
        t().http().delete("/v1/minerva/meeting/meeting-1"),
      );

      expect(res.status).toBe(200);
      expect(res.body.item.isDeleted).toBe(true);
      expect(t().graphql.calls("DeleteCalendarItem")[0].variables).toEqual({
        id: "meeting-1",
        user_id: USER,
      });
    });

    it("answers 404 for an unknown meeting or another user's", async () => {
      t().graphql.on("DeleteCalendarItem", {
        update_minerva_meetings: { returning: [] },
      });

      expect(
        (await ctx.as(t().http().delete("/v1/minerva/meeting/nope"))).status,
      ).toBe(404);
    });
  });

  describe("GET /v1/minerva/meetings/:start (ListCalendarItems)", () => {
    const list = (path: string, tz?: string) => {
      const request = t().http().get(path);
      return ctx.as(tz ? request.set("x-ncfritz-tz", tz) : request);
    };
    const variables = () =>
      t().graphql.calls("ListCalendarItems")[0]?.variables as {
        start: string;
        end: string;
        user_id: string;
      };

    it("lists the caller's meetings over the requested days", async () => {
      t().graphql.on("ListCalendarItems", {
        minerva_meetings: [graphQlMeeting()],
      });

      const res = await list("/v1/minerva/meetings/2026-09-18?days=3");

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(variables()).toEqual({
        start: "2026-09-18T00:00:00.000Z",
        end: "2026-09-21T00:00:00.000Z",
        user_id: USER,
      });
    });

    it("reads the days in the caller's timezone", async () => {
      t().graphql.on("ListCalendarItems", { minerva_meetings: [] });

      await list("/v1/minerva/meetings/2026-10-04", "America/Los_Angeles");

      expect(variables()).toEqual(
        expect.objectContaining({
          start: "2026-10-04T07:00:00.000Z",
          end: "2026-10-05T07:00:00.000Z",
        }),
      );
    });

    it("asks for what overlaps the days, not only what falls inside them", async () => {
      t().graphql.on("ListCalendarItems", { minerva_meetings: [] });

      await list("/v1/minerva/meetings/2026-09-18");

      const query = t().graphql.calls("ListCalendarItems")[0]!.document;
      expect(query).toMatch(/start_time: \{ _lt: \$end \}/);
      expect(query).toMatch(/end_time: \{ _gt: \$start \}/);
      expect(query).toMatch(/deleted: \{ _eq: false \}/);
    });

    it("defaults to one day", async () => {
      t().graphql.on("ListCalendarItems", { minerva_meetings: [] });

      await list("/v1/minerva/meetings/2026-09-18");

      expect(variables().end).toBe("2026-09-19T00:00:00.000Z");
    });

    it.each([
      ["a non-numeric day count", "/v1/minerva/meetings/2026-09-18?days=abc"],
      ["a fractional day count", "/v1/minerva/meetings/2026-09-18?days=41.99"],
      ["no days", "/v1/minerva/meetings/2026-09-18?days=0"],
      ["more than 92 days", "/v1/minerva/meetings/2026-09-18?days=93"],
      ["a start that is not a day", "/v1/minerva/meetings/null?days=7"],
    ])("rejects %s", async (_what, path) => {
      expect((await list(path)).status).toBe(400);
      expect(t().graphql.request).not.toHaveBeenCalled();
    });

    it("rejects a timezone it does not know", async () => {
      expect(
        (await list("/v1/minerva/meetings/2026-09-18", "Mars/Olympus")).status,
      ).toBe(400);
    });
  });

  describe("GET /v1/minerva/meeting/:meetingId/next (GetNextCalendarItemOccurrence)", () => {
    it("returns the next occurrence in the caller's series", async () => {
      t()
        .graphql.on("GetCalendarItemSeries", {
          minerva_meetings: [
            { uid: "uid-1", start_time: "2026-09-18T16:00:00Z" },
          ],
        })
        .on("GetNextCalendarItemOccurrence", {
          minerva_meetings: [
            graphQlMeeting({
              id: "meeting-2",
              start_time: "2026-09-25T16:00:00Z",
            }),
          ],
        });

      const res = await ctx.as(
        t().http().get("/v1/minerva/meeting/meeting-1/next"),
      );

      expect(res.status).toBe(200);
      expect(res.body.item.id).toBe("meeting-2");
      expect(t().graphql.calls("GetCalendarItemSeries")[0].variables).toEqual({
        id: "meeting-1",
        user_id: USER,
      });
      expect(
        t().graphql.calls("GetNextCalendarItemOccurrence")[0].variables,
      ).toEqual({
        uid: "uid-1",
        current_start_time: "2026-09-18T16:00:00Z",
        user_id: USER,
      });
    });

    it("returns no item after the last occurrence", async () => {
      t()
        .graphql.on("GetCalendarItemSeries", {
          minerva_meetings: [
            { uid: "uid-1", start_time: "2026-09-18T16:00:00Z" },
          ],
        })
        .on("GetNextCalendarItemOccurrence", { minerva_meetings: [] });

      const res = await ctx.as(
        t().http().get("/v1/minerva/meeting/meeting-1/next"),
      );

      expect(res.status).toBe(200);
      expect(res.body.item).toBeUndefined();
    });

    it("answers 404 for a meeting that is not the caller's or not in a series", async () => {
      t().graphql.on("GetCalendarItemSeries", { minerva_meetings: [] });

      expect(
        (await ctx.as(t().http().get("/v1/minerva/meeting/nope/next"))).status,
      ).toBe(404);
    });
  });

  describe("GET /v1/minerva/meeting/:meetingId/previous (ListPreviousCalendarItemOccurrences)", () => {
    const answerSeries = () =>
      t()
        .graphql.on("GetCalendarItemSeries", {
          minerva_meetings: [
            { uid: "uid-1", start_time: "2026-09-18T16:00:00Z" },
          ],
        })
        .on("ListPreviousCalendarItemOccurrences", {
          minerva_meetings: [graphQlMeeting({ id: "meeting-0" })],
        });

    it("lists the caller's earlier occurrences, 5 by default", async () => {
      answerSeries();

      const res = await ctx.as(
        t().http().get("/v1/minerva/meeting/meeting-1/previous"),
      );

      expect(res.status).toBe(200);
      expect(res.body.items[0].id).toBe("meeting-0");
      expect(
        t().graphql.calls("ListPreviousCalendarItemOccurrences")[0].variables,
      ).toMatchObject({ uid: "uid-1", limit: 5, user_id: USER });
    });

    it("passes the limit to Hasura as a number", async () => {
      answerSeries();

      await ctx.as(
        t().http().get("/v1/minerva/meeting/meeting-1/previous?limit=2"),
      );

      expect(
        t().graphql.calls("ListPreviousCalendarItemOccurrences")[0].variables,
      ).toMatchObject({ limit: 2 });
    });
  });

  describe("GET /v1/minerva/meetings/statistics/:start (GetMeetingsStatistics)", () => {
    it("buckets the caller's counts and durations by hour and weekday", async () => {
      t().graphql.on("GetMeetingsStatistics", {
        minerva_meeting_hour_statistics: [
          { hour: "09", status: "Busy", count: 2, duration: 90 },
        ],
        minerva_meeting_day_statistics: [
          { day: "4", status: "Busy", count: 2, duration: 90 },
        ],
      });

      const res = await ctx.as(
        t()
          .http()
          .get("/v1/minerva/meetings/statistics/2026-09-14?days=6")
          .set("x-ncfritz-tz", "America/Los_Angeles"),
      );

      expect(res.status).toBe(200);
      expect(res.body.hourOfDayStatistics["09"].Busy).toEqual({
        count: 2,
        totalDurationMin: 90,
      });
      expect(Object.keys(res.body.hourOfDayStatistics)).toHaveLength(24);
      expect(res.body.dayOfWeekStatistics["4"].Busy.count).toBe(2);

      const { start, end, tz, user_id } = t().graphql.calls(
        "GetMeetingsStatistics",
      )[0].variables as {
        start: moment.Moment;
        end: moment.Moment;
        tz: string;
        user_id: string;
      };
      expect(user_id).toBe(USER);
      expect(tz).toBe("America/Los_Angeles");
      // Through the end of the last requested day: start + 7 days - 1 second.
      expect(moment(end).diff(moment(start), "seconds")).toBe(7 * 86400 - 1);
    });
  });

  describe("GET /v1/minerva/meetings/summary/:start (GetMeetingsSummary)", () => {
    it("buckets the caller's counts by day and ignores days outside the range", async () => {
      t().graphql.on("GetMeetingsSummary", {
        minerva_meeting_status_statistics: [
          { start_date: "2026-09-15", status: "Busy", count: 3, duration: 120 },
          { start_date: "2026-10-30", status: "Busy", count: 9, duration: 9 },
        ],
      });

      const res = await ctx.as(
        t().http().get("/v1/minerva/meetings/summary/2026-09-14?days=2"),
      );

      expect(res.status).toBe(200);
      expect(Object.keys(res.body.statusStatistics)).toEqual([
        "2026-09-14",
        "2026-09-15",
        "2026-09-16",
      ]);
      expect(res.body.statusStatistics["2026-09-15"].Busy).toEqual({
        count: 3,
        totalDurationMin: 120,
      });
      const { start, end, user_id } = t().graphql.calls("GetMeetingsSummary")[0]
        .variables as {
        start: moment.Moment;
        end: moment.Moment;
        user_id: string;
      };
      expect(user_id).toBe(USER);
      expect(moment(end).diff(moment(start), "days")).toBe(3);
    });

    it("requires a numeric day count", async () => {
      expect(
        (
          await ctx.as(
            t().http().get("/v1/minerva/meetings/summary/2026-09-14"),
          )
        ).status,
      ).toBe(400);
    });
  });
});
