import { DateTime, Settings } from "luxon";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  busyMinutes,
  dailyListPath,
  dayBarBlocks,
  doneOfPlanned,
  formatBlock,
  formatMinutes,
  formatSpan,
  itemsOf,
  meetingSpans,
  noteTypeCounts,
  openCount,
  openTime,
  RATING_FIELDS,
  type ReviewMeeting,
  type ReviewPlanItem,
  stepToOpen,
  triageOf,
  dailyReviewPath,
  monthOfWeek,
  parseReviewRoute,
  reviewRouteLabel,
  type ReviewRoute,
  weeklyListPath,
  weeklyReviewPath,
} from "../../src/utils/reviews";

const at = (iso: string) => DateTime.fromISO(iso);
const now = at("2026-10-01T23:30");

/** A route's dates as ISO days, for comparing. */
const flat = (route: ReviewRoute) => {
  switch (route.view) {
    case "invalid":
      return { kind: route.kind, view: route.view };
    case "list":
      return route.kind === "daily"
        ? { kind: route.kind, view: route.view, week: route.week.toISODate() }
        : {
            kind: route.kind,
            view: route.view,
            month: route.month.toISODate(),
          };
    case "review":
      return route.kind === "daily"
        ? { kind: route.kind, view: route.view, day: route.day.toISODate() }
        : { kind: route.kind, view: route.view, week: route.week.toISODate() };
  }
};

describe("parseReviewRoute: daily", () => {
  it("lists this week with no segments", () => {
    expect(flat(parseReviewRoute("daily", undefined, now))).toEqual({
      kind: "daily",
      view: "list",
      week: "2026-09-28",
    });
  });

  it("lists an ISO week from its Monday", () => {
    expect(flat(parseReviewRoute("daily", ["2026", "W40"], now))).toEqual({
      kind: "daily",
      view: "list",
      week: "2026-09-28",
    });
  });

  it("opens a day's review", () => {
    expect(flat(parseReviewRoute("daily", ["2026", "10", "01"], now))).toEqual({
      kind: "daily",
      view: "review",
      day: "2026-10-01",
    });
  });

  it.each([
    [["2026", "02", "30"]],
    [["2026", "W00"]],
    [["2027", "W53"]],
    [["2026", "10"]],
    [["2026", "10", "01", "extra"]],
    [["twenty", "W40"]],
  ])("refuses %j", (segments) => {
    expect(parseReviewRoute("daily", segments, now).view).toBe("invalid");
  });
});

describe("parseReviewRoute: weekly", () => {
  it("lists the month this week's Thursday falls in", () => {
    expect(flat(parseReviewRoute("weekly", [], now))).toEqual({
      kind: "weekly",
      view: "list",
      month: "2026-10-01",
    });
    expect(flat(parseReviewRoute("weekly", [], at("2026-09-27")))).toEqual({
      kind: "weekly",
      view: "list",
      month: "2026-09-01",
    });
  });

  it("opens a week's review, week 53 included in a long year", () => {
    expect(flat(parseReviewRoute("weekly", ["2026", "W40"], now))).toEqual({
      kind: "weekly",
      view: "review",
      week: "2026-09-28",
    });
    expect(flat(parseReviewRoute("weekly", ["2026", "W53"], now))).toEqual({
      kind: "weekly",
      view: "review",
      week: "2026-12-28",
    });
  });

  it("lists a month", () => {
    expect(flat(parseReviewRoute("weekly", ["2026", "09"], now))).toEqual({
      kind: "weekly",
      view: "list",
      month: "2026-09-01",
    });
  });

  it.each([[["2026", "13"]], [["2027", "W53"]], [["2026", "09", "01"]]])(
    "refuses %j",
    (segments) => {
      expect(parseReviewRoute("weekly", segments, now).view).toBe("invalid");
    },
  );
});

describe("paths", () => {
  it("writes a day, a week and a month", () => {
    expect(dailyReviewPath(now)).toBe("/minerva/review/daily/2026/10/01");
    expect(dailyListPath(now)).toBe("/minerva/review/daily/2026/W40");
    expect(weeklyReviewPath(now)).toBe("/minerva/review/weekly/2026/W40");
    expect(weeklyListPath(at("2026-09-01"))).toBe(
      "/minerva/review/weekly/2026/09",
    );
  });

  it("uses the ISO week's year across new year", () => {
    expect(weeklyReviewPath(at("2027-01-01"))).toBe(
      "/minerva/review/weekly/2026/W53",
    );
    expect(dailyListPath(at("2027-01-01"))).toBe(
      "/minerva/review/daily/2026/W53",
    );
  });

  it("round-trips through the parser", () => {
    const daily = dailyReviewPath(now).split("/").slice(4);
    const weekly = weeklyReviewPath(now).split("/").slice(4);
    expect(flat(parseReviewRoute("daily", daily, now))).toEqual({
      kind: "daily",
      view: "review",
      day: "2026-10-01",
    });
    expect(flat(parseReviewRoute("weekly", weekly, now))).toEqual({
      kind: "weekly",
      view: "review",
      week: "2026-09-28",
    });
  });
});

describe("monthOfWeek", () => {
  it("is the month of the week's Thursday", () => {
    expect(monthOfWeek(at("2026-09-28")).toISODate()).toBe("2026-10-01");
    expect(monthOfWeek(at("2026-08-31")).toISODate()).toBe("2026-09-01");
    expect(monthOfWeek(at("2027-01-01")).toISODate()).toBe("2026-12-01");
  });
});

describe("reviewRouteLabel", () => {
  it("names each view's period", () => {
    expect(
      reviewRouteLabel(parseReviewRoute("daily", ["2026", "10", "01"])),
    ).toBe("Thursday, October 1, 2026");
    expect(reviewRouteLabel(parseReviewRoute("daily", ["2026", "W40"]))).toBe(
      "Week 40, 2026",
    );
    expect(reviewRouteLabel(parseReviewRoute("weekly", ["2026", "W40"]))).toBe(
      "Week 40, 2026",
    );
    expect(reviewRouteLabel(parseReviewRoute("weekly", ["2026", "09"]))).toBe(
      "September 2026",
    );
    expect(reviewRouteLabel(parseReviewRoute("weekly", ["x"]))).toBe(
      "Not a review",
    );
  });
});

describe("the review steps' helpers, in Seattle", () => {
  const zone = Settings.defaultZone;
  beforeAll(() => {
    Settings.defaultZone = "America/Los_Angeles";
  });
  afterAll(() => {
    Settings.defaultZone = zone;
  });

  const day = () => DateTime.fromISO("2026-10-01");
  const meeting = (
    id: string,
    start: string,
    end: string,
    extra: Partial<ReviewMeeting> = {},
  ): ReviewMeeting => ({
    id,
    subject: id,
    startTime: `2026-10-01T${start}:00-07:00`,
    endTime: `2026-10-01T${end}:00-07:00`,
    isAllDay: false,
    isDeleted: false,
    status: "Busy",
    ...extra,
  });
  // The canvas's Thursday, plus a meeting overlapping the planning one, an
  // all-day event, a free slot and a cancelled meeting.
  const thursday = () => [
    meeting("Daily standup", "08:30", "08:45"),
    meeting("Platform design review", "10:00", "11:00"),
    meeting("1:1", "11:30", "12:00"),
    meeting("Quarterly planning", "14:00", "15:00"),
    meeting("Hiring sync", "14:30", "15:30"),
    meeting("Vendor sync", "16:00", "16:30"),
    meeting("Offsite", "00:00", "23:59", { isAllDay: true }),
    meeting("Lunch", "12:00", "13:00", { status: "Free" }),
    meeting("Cancelled", "09:00", "10:00", { isDeleted: true }),
  ];

  it("keeps the day's timed, busy meetings, in order", () => {
    expect(meetingSpans(thursday(), day()).map((s) => s.meeting.id)).toEqual([
      "Daily standup",
      "Platform design review",
      "1:1",
      "Quarterly planning",
      "Hiring sync",
      "Vendor sync",
    ]);
  });

  it("clips a meeting that runs over midnight to the day", () => {
    const spans = meetingSpans(
      [
        meeting("Late", "23:00", "23:30", {
          endTime: "2026-10-02T01:00:00-07:00",
        }),
      ],
      day(),
    );
    expect(spans[0].end.toISO()).toBe("2026-10-02T00:00:00.000-07:00");
  });

  it("counts busy time once where meetings overlap", () => {
    // 15 + 60 + 30 + 90 (14:00 to 15:30) + 30.
    expect(busyMinutes(meetingSpans(thursday(), day()))).toBe(225);
    expect(formatMinutes(225)).toBe("3h 45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(0)).toBe("0m");
  });

  it("writes spans as the design does", () => {
    const at = (t: string) => DateTime.fromISO(`2026-10-01T${t}`);
    expect(formatSpan(at("10:00"), at("11:00"))).toBe("10:00 – 11:00");
    expect(formatSpan(at("14:00"), at("15:00"))).toBe("2:00 – 3:00 PM");
    expect(formatSpan(at("11:30"), at("12:00"))).toBe("11:30 – 12:00 PM");
    expect(formatBlock("09:00", "11:00")).toBe("9:00 – 11:00");
    expect(formatBlock("09:00")).toBeUndefined();
  });

  it("places blocks on a 7:00 to 22:00 bar", () => {
    const [standup] = dayBarBlocks(meetingSpans(thursday(), day()));
    // 8:30 is 90 of 900 minutes in; 15 minutes wide.
    expect(standup.left).toBeCloseTo(10);
    expect(standup.width).toBeCloseTo(1.6667, 3);
    expect(standup.title).toBe("Daily standup, 8:30 – 8:45");
  });

  it("finds open time of half an hour or more from 9:00 to 17:00", () => {
    const gaps = openTime(meetingSpans(thursday(), day()), day()).map((g) =>
      formatSpan(g.start, g.end),
    );
    expect(gaps).toEqual([
      "9:00 – 10:00",
      "11:00 – 11:30",
      "12:00 – 2:00 PM",
      "3:30 – 4:00 PM",
      "4:30 – 5:00 PM",
    ]);
  });

  it("has the whole window open on a day with no meetings", () => {
    const gaps = openTime([], day());
    expect(gaps).toHaveLength(1);
    expect(formatSpan(gaps[0].start, gaps[0].end)).toBe("9:00 – 5:00 PM");
  });

  it("counts notes by type", () => {
    expect([
      ...noteTypeCounts([{ type: 0 }, { type: 2 }, { type: 0 }]),
    ]).toEqual([
      [0, 2],
      [2, 1],
    ]);
  });

  const item = (
    id: string,
    periodStart: string,
    kind: ReviewPlanItem["kind"],
    status: ReviewPlanItem["status"],
    position: number,
  ): ReviewPlanItem => ({ id, periodStart, kind, status, position });
  const items = [
    item("okrs", "2026-10-01", "priority", "open", 1),
    item("rollups", "2026-10-01", "priority", "done", 0),
    item("dentist", "2026-10-01", "todo", "carried", 0),
    item("drive", "2026-10-01", "todo", "dropped", 1),
    item("nas", "2026-10-01", "todo", "open", 2),
    item("tomorrow", "2026-10-02", "priority", "open", 0),
  ];

  it("orders a day's items, priorities first", () => {
    expect(itemsOf(items, "2026-10-01").map((i) => i.id)).toEqual([
      "rollups",
      "okrs",
      "dentist",
      "drive",
      "nas",
    ]);
    expect(itemsOf(items, "2026-10-01", "todo").map((i) => i.id)).toEqual([
      "dentist",
      "drive",
      "nas",
    ]);
  });

  it("counts what is open and what was done of what was kept", () => {
    expect(openCount(items, "2026-10-01")).toBe(2);
    expect(doneOfPlanned(items, "2026-10-01")).toEqual({
      done: 1,
      planned: 4,
    });
  });

  it("shows each status's triage", () => {
    expect(triageOf("open")).toBeUndefined();
    expect(triageOf("done")).toBe("done");
    expect(triageOf("carried")).toBe("tomorrow");
    expect(triageOf("someday")).toBe("later");
    expect(triageOf("dropped")).toBe("drop");
  });

  it("opens at the step asked, else the one reached, else the first", () => {
    expect(stepToOpen("3", 4, 2)).toBe(3);
    expect(stepToOpen("9", 4, 2)).toBe(2);
    expect(stepToOpen(undefined, 4, 4)).toBe(4);
    expect(stepToOpen(["2"], 4)).toBe(1);
    expect(stepToOpen("0", 4)).toBe(1);
  });

  it("asks a day four ratings and a week three", () => {
    expect(RATING_FIELDS.daily.map((f) => f.key)).toEqual([
      "overall",
      "mood",
      "energy",
      "focus",
    ]);
    expect(RATING_FIELDS.weekly.map((f) => f.label)).toEqual([
      "Overall",
      "Progress",
      "Balance",
    ]);
  });
});
