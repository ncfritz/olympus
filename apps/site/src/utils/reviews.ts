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

/* ------------------------------------------------------------------------ */
/* The review steps: what they draw, computed without the DOM                */
/* ------------------------------------------------------------------------ */

/** A daily review's guided steps, in order. */
export const DAILY_STEPS = [
  "Look back",
  "Reflect",
  "Plan tomorrow",
  "Wrap up",
] as const;

/** A rating a review asks for, and the words at its ends. */
export type RatingField = {
  key: "overall" | "mood" | "energy" | "focus" | "progress" | "balance";
  label: string;
  low: string;
  high: string;
};

/** The ratings each kind of review asks for, in the order asked. */
export const RATING_FIELDS: Record<ReviewKind, RatingField[]> = {
  daily: [
    { key: "overall", label: "Overall", low: "Low", high: "High" },
    { key: "mood", label: "Mood", low: "Low", high: "High" },
    { key: "energy", label: "Energy", low: "Low", high: "High" },
    { key: "focus", label: "Focus", low: "Scattered", high: "Locked in" },
  ],
  weekly: [
    { key: "overall", label: "Overall", low: "Low", high: "High" },
    { key: "progress", label: "Progress", low: "Stalled", high: "Moved a lot" },
    { key: "balance", label: "Balance", low: "Work-heavy", high: "Balanced" },
  ],
};

/**
 * The step a review opens at: `?step=` when it is one of the steps, else
 * the step the review reached, else the first. Steps count from 1.
 */
export const stepToOpen = (
  query: unknown,
  steps: number,
  reached?: number,
): number => {
  const asked = typeof query === "string" ? Number(query) : NaN;
  if (Number.isInteger(asked) && asked >= 1 && asked <= steps) return asked;
  if (reached !== undefined && reached >= 1 && reached <= steps) {
    return reached;
  }
  return 1;
};

/** A calendar item as the review steps use it. */
export type ReviewMeeting = {
  id: string;
  subject: string;
  startTime: string;
  endTime?: string;
  isAllDay: boolean;
  isDeleted: boolean;
  status: string;
};

/** A meeting's span within a day, as local times. */
export type MeetingSpan = {
  meeting: ReviewMeeting;
  start: DateTime;
  end: DateTime;
};

/**
 * The day's timed meetings that take time, clipped to the day: all-day
 * events, deleted ones and those shown as free are left out.
 */
export const meetingSpans = (
  meetings: ReviewMeeting[],
  day: DateTime,
): MeetingSpan[] => {
  const dayStart = day.startOf("day");
  const dayEnd = dayStart.plus({ days: 1 });
  return meetings
    .filter((m) => !m.isAllDay && !m.isDeleted && m.status !== "Free")
    .map((meeting) => {
      const start = DateTime.fromISO(meeting.startTime);
      const end = meeting.endTime
        ? DateTime.fromISO(meeting.endTime)
        : start.plus({ minutes: 30 });
      return {
        meeting,
        start: start < dayStart ? dayStart : start,
        end: end > dayEnd ? dayEnd : end,
      };
    })
    .filter((span) => span.end > span.start)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());
};

/** Minutes the spans cover, overlaps counted once. */
export const busyMinutes = (spans: MeetingSpan[]): number => {
  let total = 0;
  let reach: DateTime | undefined;
  for (const { start, end } of spans) {
    const from = reach && reach > start ? reach : start;
    if (end > from) total += end.diff(from, "minutes").minutes;
    if (!reach || end > reach) reach = end;
  }
  return Math.round(total);
};

/** Minutes as the design writes them: 3h 45m, 2h, 45m, 0m. */
export const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
};

/** A time as the design writes it: 9:00, 2:30 PM after noon. */
export const formatClock = (time: DateTime): string =>
  time.hour < 12 ? time.toFormat("h:mm") : time.toFormat("h:mm a");

/** A span as the design writes it: 10:00 – 11:00, 2:00 – 3:00 PM. */
export const formatSpan = (start: DateTime, end: DateTime): string => {
  const sameHalf = start.hour < 12 === end.hour < 12;
  const from =
    sameHalf || start.hour < 12
      ? start.toFormat("h:mm")
      : start.toFormat("h:mm a");
  return `${from} – ${formatClock(end)}`;
};

/** A block on the day bar: where it starts and how wide, in percent. */
export type DayBarBlock = {
  key: string;
  title: string;
  left: number;
  width: number;
};

/** The spans as blocks on a bar from `fromHour` to `toHour`. */
export const dayBarBlocks = (
  spans: MeetingSpan[],
  fromHour = 7,
  toHour = 22,
): DayBarBlock[] => {
  const range = (toHour - fromHour) * 60;
  const minuteOf = (t: DateTime) => (t.hour - fromHour) * 60 + t.minute;
  return spans
    .map(({ meeting, start, end }) => {
      const from = Math.max(0, minuteOf(start));
      const to = Math.min(
        range,
        end.hasSame(start, "day") ? minuteOf(end) : range,
      );
      return {
        key: meeting.id,
        title: `${meeting.subject}, ${formatSpan(start, end)}`,
        left: (from / range) * 100,
        width: ((to - from) / range) * 100,
      };
    })
    .filter((block) => block.width > 0);
};

/**
 * The gaps between the day's meetings from `fromHour` to `toHour` at
 * least `minMinutes` long: the open time a priority can be put in.
 */
export const openTime = (
  spans: MeetingSpan[],
  day: DateTime,
  fromHour = 9,
  toHour = 17,
  minMinutes = 30,
): { start: DateTime; end: DateTime }[] => {
  const windowStart = day.startOf("day").set({ hour: fromHour });
  const windowEnd = day.startOf("day").set({ hour: toHour });
  const gaps: { start: DateTime; end: DateTime }[] = [];
  let cursor = windowStart;
  for (const { start, end } of spans) {
    if (end <= cursor) continue;
    if (start >= windowEnd) break;
    if (start > cursor) gaps.push({ start: cursor, end: start });
    if (end > cursor) cursor = end;
  }
  if (cursor < windowEnd) gaps.push({ start: cursor, end: windowEnd });
  return gaps.filter(
    (gap) => gap.end.diff(gap.start, "minutes").minutes >= minMinutes,
  );
};

/** How many of each note type there are, by the type's number. */
export const noteTypeCounts = (
  notes: { type: number }[],
): Map<number, number> => {
  const counts = new Map<number, number>();
  for (const note of notes) {
    counts.set(note.type, (counts.get(note.type) ?? 0) + 1);
  }
  return counts;
};

/** A plan item as the review steps use it. */
export type ReviewPlanItem = {
  id: string;
  periodStart: string;
  kind: "priority" | "todo";
  status: "open" | "done" | "carried" | "someday" | "dropped";
  position: number;
};

/** A day's items of a kind, in their order. */
export const itemsOf = <T extends ReviewPlanItem>(
  items: T[],
  day: string,
  kind?: ReviewPlanItem["kind"],
): T[] =>
  items
    .filter((i) => i.periodStart === day && (!kind || i.kind === kind))
    .sort((a, b) =>
      a.kind === b.kind
        ? a.position - b.position
        : a.kind === "priority"
          ? -1
          : 1,
    );

/** How many of a day's items are still open, waiting for a decision. */
export const openCount = (items: ReviewPlanItem[], day: string): number =>
  itemsOf(items, day).filter((i) => i.status === "open").length;

/** A triage decision, as Look back offers it. */
export type Triage = "done" | "tomorrow" | "later" | "drop";

/** The decision an item's status shows, if one was made. */
export const triageOf = (
  status: ReviewPlanItem["status"],
): Triage | undefined =>
  ({
    open: undefined,
    done: "done",
    carried: "tomorrow",
    someday: "later",
    dropped: "drop",
  })[status] as Triage | undefined;

/** Done of what was planned for a day: carried ones are not counted. */
export const doneOfPlanned = (
  items: ReviewPlanItem[],
  day: string,
): { done: number; planned: number } => {
  const kept = itemsOf(items, day).filter((i) => i.status !== "carried");
  return {
    done: kept.filter((i) => i.status === "done").length,
    planned: kept.length,
  };
};

/** "HH:mm" from the API as the design writes it. */
export const formatBlock = (
  start?: string,
  end?: string,
): string | undefined => {
  if (!start || !end) return undefined;
  const at = (clock: string) => DateTime.fromFormat(clock, "HH:mm");
  return formatSpan(at(start), at(end));
};
