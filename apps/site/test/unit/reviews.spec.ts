import { DateTime, Settings } from "luxon";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  answeredPrompts,
  answersByPrompt,
  blockedSpan,
  busyMinutes,
  type ChainItem,
  daysOfWeek,
  loadLevel,
  ratingChanges,
  ratingSeries,
  slippedItems,
  weekLoad,
  weekTriageOf,
  WEEKLY_STEPS,
  dailyListPath,
  dayBarBlocks,
  doneOfPlanned,
  formatBlock,
  placeLabel,
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

  it("writes a week's item's place with its day", () => {
    expect(
      placeLabel({
        scheduledOn: "2026-10-06",
        scheduledStart: "09:30",
        scheduledEnd: "11:00",
      }),
    ).toBe("Tue 9:30 – 11:00");
    expect(placeLabel({ scheduledOn: "2026-10-06" })).toBeUndefined();
    expect(placeLabel({})).toBeUndefined();
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

describe("the weekly review's arithmetic, in Seattle", () => {
  const zone = Settings.defaultZone;
  beforeAll(() => {
    Settings.defaultZone = "America/Los_Angeles";
  });
  afterAll(() => {
    Settings.defaultZone = zone;
  });

  // Week 40: Monday 2026-09-28 to Sunday 2026-10-04.
  const monday = () => DateTime.fromISO("2026-09-28");
  const days = () => daysOfWeek(monday()).map((d) => d.toISODate()!);
  const meeting = (
    id: string,
    day: string,
    start: string,
    end: string,
    extra: Partial<ReviewMeeting> = {},
  ): ReviewMeeting => ({
    id,
    subject: id,
    startTime: `${day}T${start}:00-07:00`,
    endTime: `${day}T${end}:00-07:00`,
    isAllDay: false,
    isDeleted: false,
    status: "Busy",
    ...extra,
  });

  it("walks five steps", () => {
    expect(WEEKLY_STEPS).toEqual([
      "Look back",
      "Highlights",
      "Reflect",
      "Plan next week",
      "Wrap up",
    ]);
  });

  it("lists a week's seven days, or its five working ones", () => {
    expect(days()).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(daysOfWeek(monday(), 5).map((d) => d.toFormat("ccc"))).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
    ]);
  });

  describe("weekLoad", () => {
    const meetings = () => [
      meeting("Standup", "2026-09-28", "08:30", "08:45"),
      meeting("Design review", "2026-09-28", "10:00", "11:00"),
      meeting("Planning", "2026-09-28", "14:00", "15:00"),
      meeting("Hiring sync", "2026-09-28", "14:30", "15:30"),
      meeting("Offsite", "2026-09-29", "00:00", "23:59", { isAllDay: true }),
      meeting("Free", "2026-09-29", "10:00", "12:00", { status: "Free" }),
      meeting("All morning", "2026-09-30", "09:00", "13:00"),
      meeting("All afternoon", "2026-09-30", "13:00", "16:00"),
      // Late on Thursday, running past midnight into Friday.
      meeting("Release", "2026-10-01", "23:00", "23:59"),
      meeting("Release, after", "2026-10-02", "00:00", "01:00"),
    ];
    const block = (
      id: string,
      on: string,
      start: string,
      end: string,
      status: ChainItem["status"] = "open",
    ) => ({
      id,
      title: id,
      status,
      scheduledOn: on,
      scheduledStart: start,
      scheduledEnd: end,
    });

    it("counts each day's meetings, minutes and load", () => {
      const load = weekLoad(meetings(), daysOfWeek(monday(), 5));
      expect(load.map((d) => d.day)).toEqual(days().slice(0, 5));
      expect(load[0]).toEqual({
        day: "2026-09-28",
        meetings: 4,
        meetingMinutes: 165,
        focusMinutes: 0,
        // 10:00–11:00 and 14:00–15:30 of 9 to 5; the standup is before 9.
        load: 0.31,
        level: "light",
      });
      // All-day and free events take no time.
      expect(load[1]).toMatchObject({ meetings: 0, load: 0, level: "light" });
      expect(load[2]).toMatchObject({
        meetings: 2,
        meetingMinutes: 420,
        load: 0.88,
        level: "heavy",
      });
      // Each day keeps its own part of the night.
      expect(load[3]).toMatchObject({ meetings: 1, meetingMinutes: 59 });
      expect(load[4]).toMatchObject({ meetings: 1, meetingMinutes: 60 });
    });

    it("adds blocked priorities to the load, but not dropped or carried ones", () => {
      const load = weekLoad(meetings(), daysOfWeek(monday(), 2), [
        block("Weather plan", "2026-09-28", "13:00", "15:00"),
        block("Dropped", "2026-09-28", "09:00", "10:00", "dropped"),
        block("Carried", "2026-09-28", "11:00", "12:00", "carried"),
        block("Tuesday", "2026-09-29", "09:00", "11:00"),
        { id: "Unblocked", title: "Unblocked", status: "open" as const },
      ]);
      expect(load[0]).toMatchObject({
        focusMinutes: 120,
        // 10–11, then 13:00–15:30 with the overlap once: 3h 30m of 8h.
        load: 0.44,
        level: "moderate",
      });
      expect(load[1]).toMatchObject({ focusMinutes: 120, load: 0.25 });
    });

    it("reads a day's level from its share", () => {
      expect(loadLevel(0)).toBe("light");
      expect(loadLevel(0.39)).toBe("light");
      expect(loadLevel(0.4)).toBe("moderate");
      expect(loadLevel(0.69)).toBe("moderate");
      expect(loadLevel(0.7)).toBe("heavy");
    });

    it("makes a span of a blocked item, on its day", () => {
      const span = blockedSpan(
        block("Weather plan", "2026-09-30", "13:00", "15:00"),
      );
      expect(span?.start.toISO()).toBe("2026-09-30T13:00:00.000-07:00");
      expect(span?.end.toFormat("HH:mm")).toBe("15:00");
      expect(
        blockedSpan({
          id: "x",
          title: "x",
          status: "open",
          scheduledOn: "2026-09-30",
        }),
      ).toBeUndefined();
    });
  });

  describe("slippedItems", () => {
    const item = (
      id: string,
      periodStart: string,
      extra: Partial<ChainItem> = {},
    ): ChainItem => ({
      id,
      periodStart,
      kind: "priority",
      status: "open",
      position: 0,
      carryCount: 0,
      ...extra,
    });
    const ids = (items: ChainItem[]) => items.map((i) => i.id);

    it("keeps each chain's last link in the week", () => {
      const items = [
        // Planned Monday, carried Tuesday and Wednesday, open on Wednesday.
        item("mon", "2026-09-28", { status: "carried" }),
        item("tue", "2026-09-29", {
          status: "carried",
          carryCount: 1,
          carriedFromId: "mon",
        }),
        item("wed", "2026-09-30", { carryCount: 2, carriedFromId: "tue" }),
        // Carried once, then done.
        item("thu", "2026-10-01", { status: "carried" }),
        item("fri", "2026-10-02", {
          status: "done",
          carryCount: 1,
          carriedFromId: "thu",
        }),
        // Done the day it was planned: not slipped.
        item("kept", "2026-09-29", { status: "done" }),
      ];
      expect(ids(slippedItems(items, monday(), "2026-10-03"))).toEqual([
        "wed",
        "fri",
      ]);
    });

    it("keeps an item carried out of the week, and one carried in from before it", () => {
      const items = [
        item("before", "2026-09-27", { status: "carried" }),
        item("in", "2026-09-28", { carryCount: 1, carriedFromId: "before" }),
        item("sun", "2026-10-04", { status: "carried" }),
        item("next", "2026-10-05", { carryCount: 1, carriedFromId: "sun" }),
      ];
      expect(ids(slippedItems(items, monday(), "2026-10-05"))).toEqual([
        "in",
        "sun",
      ]);
    });

    it("keeps what was left open on a day before today, not today's", () => {
      const items = [
        item("tuesday", "2026-09-29"),
        item("someday", "2026-09-29", { status: "someday" }),
        item("today", "2026-10-01"),
        item("friday", "2026-10-02"),
      ];
      expect(ids(slippedItems(items, monday(), "2026-10-01"))).toEqual([
        "tuesday",
      ]);
    });

    it("orders by day, priorities first, each in its order", () => {
      const items = [
        item("wed-todo", "2026-09-30", { kind: "todo", carryCount: 1 }),
        item("wed-2", "2026-09-30", { position: 1, carryCount: 1 }),
        item("wed-1", "2026-09-30", { position: 0, carryCount: 1 }),
        item("mon", "2026-09-28", { carryCount: 1 }),
      ];
      expect(ids(slippedItems(items, monday(), "2026-10-05"))).toEqual([
        "mon",
        "wed-1",
        "wed-2",
        "wed-todo",
      ]);
    });

    it("shows a carried item as gone to next week", () => {
      expect(weekTriageOf("open")).toBeUndefined();
      expect(weekTriageOf("carried")).toBe("next");
      expect(weekTriageOf("someday")).toBe("later");
      expect(weekTriageOf("done")).toBe("done");
      expect(weekTriageOf("dropped")).toBe("drop");
    });
  });

  describe("the ratings chart", () => {
    // The canvas's week 39 with Thursday missed, as week 40.
    const periods = [
      {
        periodStart: "2026-09-28",
        ratings: { overall: 4, mood: 4, energy: 4, focus: 4 },
      },
      {
        periodStart: "2026-09-29",
        ratings: { overall: 3, mood: 3, energy: 3 },
      },
      {
        periodStart: "2026-09-30",
        ratings: { overall: 2, mood: 3, energy: 2, focus: 2 },
      },
      { periodStart: "2026-10-01", ratings: {} },
      {
        periodStart: "2026-10-02",
        ratings: { overall: 4, mood: 4, energy: 3, focus: 4 },
      },
    ];

    it("draws a series per rating, a gap where a day has none", () => {
      const series = ratingSeries(periods, days(), RATING_FIELDS.daily);
      expect(series.map((s) => s.label)).toEqual([
        "Overall",
        "Mood",
        "Energy",
        "Focus",
      ]);
      expect(series[0].data).toEqual([4, 3, 2, null, 4, null, null]);
      expect(series[3].data).toEqual([4, null, 2, null, 4, null, null]);
    });

    it("fills a gap once a quick score is saved", () => {
      const scored = periods.map((p) =>
        p.periodStart === "2026-10-01" ? { ...p, ratings: { overall: 3 } } : p,
      );
      const [overall, mood] = ratingSeries(scored, days(), RATING_FIELDS.daily);
      expect(overall.data[3]).toBe(3);
      expect(mood.data[3]).toBeNull();
    });

    it("sets each average against last week's", () => {
      expect(
        ratingChanges(
          { overall: 3.67, mood: 3.5, energy: 3 },
          { overall: 3.2, mood: 3.5, focus: 3 },
          RATING_FIELDS.daily,
        ),
      ).toEqual([
        {
          key: "overall",
          label: "Overall",
          value: 3.67,
          previous: 3.2,
          change: 0.47,
        },
        { key: "mood", label: "Mood", value: 3.5, previous: 3.5, change: 0 },
        {
          key: "energy",
          label: "Energy",
          value: 3,
          previous: undefined,
          change: undefined,
        },
        {
          key: "focus",
          label: "Focus",
          value: undefined,
          previous: 3,
          change: undefined,
        },
      ]);
    });
  });

  describe("answersByPrompt", () => {
    const prompts = [
      { id: "well", section: "reflect", archived: false },
      { id: "not", section: "reflect", archived: false },
      { id: "old", section: "reflect", archived: true },
      { id: "gone", section: "reflect", archived: true },
      { id: "tomorrow", section: "plan", archived: false },
    ];
    const answer = (promptId: string, body: string) => ({ promptId, body });

    it("groups the week's answers under their prompts, by day", () => {
      const groups = answersByPrompt(prompts, [
        {
          periodStart: "2026-09-30",
          answers: [
            { ...answer("well", "Lunch"), position: 1 },
            { ...answer("well", "Shipped"), position: 0 },
            answer("tomorrow", "Rest"),
          ],
        },
        {
          periodStart: "2026-09-28",
          answers: [answer("well", "Approved"), answer("old", "Kept")],
        },
        { periodStart: "2026-09-29", answers: [answer("not", "   ")] },
      ]);
      expect(
        groups.map((g) => [
          g.prompt.id,
          g.answers.map((a) => `${a.day} ${a.answer.body}`),
        ]),
      ).toEqual([
        [
          "well",
          ["2026-09-28 Approved", "2026-09-30 Shipped", "2026-09-30 Lunch"],
        ],
        // Asked but unanswered: an empty column; a blank answer is none.
        ["not", []],
        // Archived, kept where a day answered it.
        ["old", ["2026-09-28 Kept"]],
      ]);
    });
  });

  describe("answeredPrompts", () => {
    const prompts = [
      { id: "well", section: "reflect" },
      { id: "else", section: "reflect" },
      { id: "not", section: "reflect" },
      { id: "tomorrow", section: "plan" },
    ];
    const answer = (promptId: string, body: string, position = 0) => ({
      promptId,
      body,
      position,
    });

    it("keeps a section's answered prompts, each list in its order", () => {
      const answers = [
        answer("else", "A long day."),
        answer("well", "Lunch outside", 2),
        answer("tomorrow", "Rest"),
        answer("well", "Design review landed", 0),
        answer("well", "Vendor call", 1),
      ];
      expect(
        answeredPrompts(prompts, answers, "reflect").map((g) => [
          g.prompt.id,
          g.answers.map((a) => a.body),
        ]),
      ).toEqual([
        ["well", ["Design review landed", "Vendor call", "Lunch outside"]],
        ["else", ["A long day."]],
      ]);
      expect(answeredPrompts(prompts, answers, "plan")).toHaveLength(1);
    });
  });
});
