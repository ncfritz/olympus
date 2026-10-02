import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  dailyListPath,
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
