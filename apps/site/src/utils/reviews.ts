import { DateTime } from "luxon";

/*
 * The daily and weekly reviews (ADR 0027): their routes, as
 * docs/plans/activity-review/design.md lays them out. Weeks are ISO,
 * Monday to Sunday; a week belongs to the month its Thursday falls in.
 */

export type ReviewKind = "daily" | "weekly";

/** What a review route asks for: one review, a list, or nothing it knows. */
export type ReviewRoute =
  | { kind: "daily"; view: "review"; day: DateTime }
  | { kind: "daily"; view: "list"; week: DateTime }
  | { kind: "weekly"; view: "review"; week: DateTime }
  | { kind: "weekly"; view: "list"; month: DateTime }
  | { kind: ReviewKind; view: "invalid" };

const BASE = "/minerva/review";

const YEAR = /^\d{4}$/;
const MONTH = /^\d{2}$/;
const DAY = /^\d{2}$/;
const WEEK = /^W\d{2}$/;

/** The Monday a date's ISO week starts on. */
export const weekStart = (date: DateTime): DateTime =>
  date.startOf("week").startOf("day");

/** The first of the month a date's ISO week is listed under: its Thursday's. */
export const monthOfWeek = (date: DateTime): DateTime =>
  weekStart(date).plus({ days: 3 }).startOf("month");

const isoWeek = (year: string, week: string): DateTime | undefined => {
  const weekNumber = parseInt(week.substring(1), 10);
  const monday = DateTime.fromObject({
    weekYear: parseInt(year, 10),
    weekNumber,
    weekday: 1,
  });
  if (
    !monday.isValid ||
    weekNumber < 1 ||
    weekNumber > monday.weeksInWeekYear
  ) {
    return undefined;
  }
  return monday;
};

const calendarDate = (
  year: string,
  month: string,
  day = "01",
): DateTime | undefined => {
  const date = DateTime.fromObject({
    year: parseInt(year, 10),
    month: parseInt(month, 10),
    day: parseInt(day, 10),
  });
  return date.isValid ? date : undefined;
};

/**
 * Reads a review route's segments after `/minerva/review/<kind>`. With none,
 * the daily list is this week's and the weekly list this week's month.
 */
export const parseReviewRoute = (
  kind: ReviewKind,
  segments: string[] | undefined,
  now: DateTime = DateTime.now(),
): ReviewRoute => {
  const parts = segments ?? [];
  const invalid: ReviewRoute = { kind, view: "invalid" };

  if (kind === "daily") {
    if (parts.length === 0) {
      return { kind, view: "list", week: weekStart(now) };
    }
    if (parts.length === 2 && YEAR.test(parts[0]) && WEEK.test(parts[1])) {
      const week = isoWeek(parts[0], parts[1]);
      return week ? { kind, view: "list", week } : invalid;
    }
    if (
      parts.length === 3 &&
      YEAR.test(parts[0]) &&
      MONTH.test(parts[1]) &&
      DAY.test(parts[2])
    ) {
      const day = calendarDate(parts[0], parts[1], parts[2]);
      return day ? { kind, view: "review", day } : invalid;
    }
    return invalid;
  }

  if (parts.length === 0) {
    return { kind, view: "list", month: monthOfWeek(now) };
  }
  if (parts.length === 2 && YEAR.test(parts[0]) && WEEK.test(parts[1])) {
    const week = isoWeek(parts[0], parts[1]);
    return week ? { kind, view: "review", week } : invalid;
  }
  if (parts.length === 2 && YEAR.test(parts[0]) && MONTH.test(parts[1])) {
    const month = calendarDate(parts[0], parts[1]);
    return month ? { kind, view: "list", month } : invalid;
  }
  return invalid;
};

/** A day's daily review. */
export const dailyReviewPath = (day: DateTime): string =>
  `${BASE}/daily/${day.toFormat("yyyy/MM/dd")}`;

/** The daily list of a date's ISO week. */
export const dailyListPath = (date: DateTime): string =>
  `${BASE}/daily/${date.toFormat("kkkk")}/W${date.toFormat("WW")}`;

/** The weekly review of a date's ISO week. */
export const weeklyReviewPath = (date: DateTime): string =>
  `${BASE}/weekly/${date.toFormat("kkkk")}/W${date.toFormat("WW")}`;

/** The weekly list of a month. */
export const weeklyListPath = (month: DateTime): string =>
  `${BASE}/weekly/${month.toFormat("yyyy/MM")}`;

/** The words a route's title and breadcrumb use for its period. */
export const reviewRouteLabel = (route: ReviewRoute): string => {
  switch (route.view) {
    case "invalid":
      return "Not a review";
    case "list":
      return route.kind === "daily"
        ? `Week ${route.week.toFormat("W, kkkk")}`
        : route.month.toFormat("MMMM yyyy");
    case "review":
      return route.kind === "daily"
        ? route.day.toFormat("cccc, LLLL d, yyyy")
        : `Week ${route.week.toFormat("W, kkkk")}`;
  }
};
