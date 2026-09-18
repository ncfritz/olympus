import moment from "moment";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { graphQlMeeting } from "../../fixtures/minerva";
import { createTestApp, type TestApp } from "../../support/testApp";

describe("Minerva calendar API", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => t.reset());

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
      ],
    };

    it("upserts the meeting with its organizer and attendees", async () => {
      t.graphql.on("CreateMeeting", {
        insert_minerva_meetings_one: graphQlMeeting(),
      });

      const res = await t.http().post("/v1/minerva/meetings").send({ item });

      expect(res.status).toBe(201);
      expect(res.body.item).toMatchObject({ id: "meeting-1", duration: 90 });
      const variables = t.graphql.calls("CreateMeeting")[0].variables!;
      expect(variables).toMatchObject({
        id: "meeting-1",
        all_day: false,
        deleted: false,
        organizer: { given_name: "Lee", surname: "Dar" },
      });
      expect(variables.attendees).toEqual([
        expect.objectContaining({
          attendance: "Required",
          user: expect.objectContaining({
            data: expect.objectContaining({ given_name: "Neil" }),
          }),
        }),
      ]);
    });
  });

  describe("GET /v1/minerva/meeting/:meetingId (DescribeCalendarItem)", () => {
    it("returns the meeting", async () => {
      t.graphql.on("DescribeCalendarItem", {
        minerva_meetings_by_pk: graphQlMeeting(),
      });

      const res = await t.http().get("/v1/minerva/meeting/meeting-1");

      expect(res.status).toBe(200);
      expect(res.body.item).toMatchObject({
        id: "meeting-1",
        startTime: "2026-09-18T16:00:00.000Z",
      });
    });

    it("answers 404 for an unknown meeting", async () => {
      t.graphql.on("DescribeCalendarItem", { minerva_meetings_by_pk: null });

      expect((await t.http().get("/v1/minerva/meeting/nope")).status).toBe(404);
    });
  });

  describe("PUT /v1/minerva/meeting/:meetingId (UpdateCalendarItem)", () => {
    it("applies the changes", async () => {
      t.graphql.on("UpdateMeeting", {
        update_minerva_meetings_by_pk: graphQlMeeting({ subject: "Renamed" }),
      });

      const res = await t
        .http()
        .put("/v1/minerva/meeting/meeting-1")
        .send({ item: { subject: "Renamed" } });

      expect(res.status).toBe(200);
      expect(res.body.item.subject).toBe("Renamed");
      expect(t.graphql.calls("UpdateMeeting")[0].variables).toEqual({
        id: "meeting-1",
        changes: { subject: "Renamed" },
      });
    });

    it("answers 304 without touching Hasura for an empty change set", async () => {
      const res = await t
        .http()
        .put("/v1/minerva/meeting/meeting-1")
        .send({ item: {} });

      expect(res.status).toBe(304);
      expect(t.graphql.request).not.toHaveBeenCalled();
    });

    it("answers 404 for an unknown meeting", async () => {
      t.graphql.on("UpdateMeeting", { update_minerva_meetings_by_pk: null });

      const res = await t
        .http()
        .put("/v1/minerva/meeting/nope")
        .send({ item: { subject: "x" } });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /v1/minerva/meeting/:meetingId (DeleteCalendarItem)", () => {
    it("marks the meeting deleted", async () => {
      t.graphql.on("DeleteCalendarItem", {
        update_minerva_meetings_by_pk: graphQlMeeting({ deleted: true }),
      });

      const res = await t.http().delete("/v1/minerva/meeting/meeting-1");

      expect(res.status).toBe(200);
      expect(res.body.item.isDeleted).toBe(true);
    });

    it("answers 404 for an unknown meeting", async () => {
      t.graphql.on("DeleteCalendarItem", {
        update_minerva_meetings_by_pk: null,
      });

      expect((await t.http().delete("/v1/minerva/meeting/nope")).status).toBe(
        404,
      );
    });
  });

  describe("GET /v1/minerva/meetings/:start (ListCalendarItems)", () => {
    it("lists meetings from the start day for the requested days", async () => {
      t.graphql.on("ListCalendarItems", {
        minerva_meetings: [graphQlMeeting()],
      });

      const res = await t.http().get("/v1/minerva/meetings/2026-09-18?days=3");

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      const { start, end } = t.graphql.calls("ListCalendarItems")[0]
        .variables as { start: moment.Moment; end: moment.Moment };
      expect(moment(end).diff(moment(start), "days")).toBe(3);
    });

    it("defaults to one day", async () => {
      t.graphql.on("ListCalendarItems", { minerva_meetings: [] });

      await t.http().get("/v1/minerva/meetings/2026-09-18");

      const { start, end } = t.graphql.calls("ListCalendarItems")[0]
        .variables as { start: moment.Moment; end: moment.Moment };
      expect(moment(end).diff(moment(start), "days")).toBe(1);
    });

    it("rejects a non-numeric day count", async () => {
      expect(
        (await t.http().get("/v1/minerva/meetings/2026-09-18?days=abc")).status,
      ).toBe(400);
    });
  });

  describe("GET /v1/minerva/meeting/:meetingId/next (GetNextCalendarItemOccurrence)", () => {
    it("returns the next occurrence in the series", async () => {
      t.graphql
        .on("GetCalendarItemSeries", {
          minerva_meetings_by_pk: {
            uid: "uid-1",
            start_time: "2026-09-18T16:00:00Z",
          },
        })
        .on("GetNextCalendarItemOccurrence", {
          minerva_meetings: [
            graphQlMeeting({
              id: "meeting-2",
              start_time: "2026-09-25T16:00:00Z",
            }),
          ],
        });

      const res = await t.http().get("/v1/minerva/meeting/meeting-1/next");

      expect(res.status).toBe(200);
      expect(res.body.item.id).toBe("meeting-2");
      expect(
        t.graphql.calls("GetNextCalendarItemOccurrence")[0].variables,
      ).toEqual({ uid: "uid-1", current_start_time: "2026-09-18T16:00:00Z" });
    });

    it("returns no item after the last occurrence", async () => {
      t.graphql
        .on("GetCalendarItemSeries", {
          minerva_meetings_by_pk: {
            uid: "uid-1",
            start_time: "2026-09-18T16:00:00Z",
          },
        })
        .on("GetNextCalendarItemOccurrence", { minerva_meetings: [] });

      const res = await t.http().get("/v1/minerva/meeting/meeting-1/next");

      expect(res.status).toBe(200);
      expect(res.body.item).toBeUndefined();
    });

    it("answers 404 for a meeting that is not part of a series", async () => {
      t.graphql.on("GetCalendarItemSeries", { minerva_meetings_by_pk: null });

      expect((await t.http().get("/v1/minerva/meeting/nope/next")).status).toBe(
        404,
      );
    });
  });

  describe("GET /v1/minerva/meeting/:meetingId/previous (ListPreviousCalendarItemOccurrences)", () => {
    beforeEach(() => {
      t.graphql
        .on("GetCalendarItemSeries", {
          minerva_meetings_by_pk: {
            uid: "uid-1",
            start_time: "2026-09-18T16:00:00Z",
          },
        })
        .on("ListPreviousCalendarItemOccurrences", {
          minerva_meetings: [graphQlMeeting({ id: "meeting-0" })],
        });
    });

    it("lists earlier occurrences, 5 by default", async () => {
      const res = await t.http().get("/v1/minerva/meeting/meeting-1/previous");

      expect(res.status).toBe(200);
      expect(res.body.items[0].id).toBe("meeting-0");
      expect(
        t.graphql.calls("ListPreviousCalendarItemOccurrences")[0].variables,
      ).toMatchObject({ uid: "uid-1", limit: 5 });
    });

    it("passes the limit to Hasura as a number", async () => {
      await t.http().get("/v1/minerva/meeting/meeting-1/previous?limit=2");

      expect(
        t.graphql.calls("ListPreviousCalendarItemOccurrences")[0].variables,
      ).toMatchObject({ limit: 2 });
    });
  });

  describe("GET /v1/minerva/meetings/statistics/:start (GetMeetingsStatistics)", () => {
    it("buckets counts and durations by hour and weekday", async () => {
      t.graphql.on("GetMeetingsStatistics", {
        minerva_meeting_hour_statistics: [
          { hour: "09", status: "Busy", count: 2, duration: 90 },
        ],
        minerva_meeting_day_statistics: [
          { day: "4", status: "Busy", count: 2, duration: 90 },
        ],
      });

      const res = await t
        .http()
        .get("/v1/minerva/meetings/statistics/2026-09-14?days=6")
        .set("x-ncfritz-tz", "America/Los_Angeles");

      expect(res.status).toBe(200);
      expect(res.body.hourOfDayStatistics["09"].Busy).toEqual({
        count: 2,
        totalDurationMin: 90,
      });
      expect(Object.keys(res.body.hourOfDayStatistics)).toHaveLength(24);
      expect(res.body.dayOfWeekStatistics["4"].Busy.count).toBe(2);

      const { start, end, tz } = t.graphql.calls("GetMeetingsStatistics")[0]
        .variables as { start: moment.Moment; end: moment.Moment; tz: string };
      expect(tz).toBe("America/Los_Angeles");
      // Through the end of the last requested day: start + 7 days - 1 second.
      expect(moment(end).diff(moment(start), "seconds")).toBe(7 * 86400 - 1);
    });
  });

  describe("GET /v1/minerva/meetings/summary/:start (GetMeetingsSummary)", () => {
    it("buckets counts by day and ignores days outside the range", async () => {
      t.graphql.on("GetMeetingsSummary", {
        minerva_meeting_status_statistics: [
          { start_date: "2026-09-15", status: "Busy", count: 3, duration: 120 },
          { start_date: "2026-10-30", status: "Busy", count: 9, duration: 9 },
        ],
      });

      const res = await t
        .http()
        .get("/v1/minerva/meetings/summary/2026-09-14?days=2");

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
      const { start, end } = t.graphql.calls("GetMeetingsSummary")[0]
        .variables as { start: moment.Moment; end: moment.Moment };
      expect(moment(end).diff(moment(start), "days")).toBe(3);
    });

    it("requires a numeric day count", async () => {
      expect(
        (await t.http().get("/v1/minerva/meetings/summary/2026-09-14")).status,
      ).toBe(400);
    });
  });
});
