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
    { key: "focus", label: "Focus", low: "Low", high: "High" },
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

/**
 * Where a week's item sits, as the design writes it: its day and block of
 * time ("Tue 9:30 – 11:00 AM"), or nothing when it has no block.
 */
export const placeLabel = (item: {
  scheduledOn?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}): string | undefined => {
  const block = formatBlock(item.scheduledStart, item.scheduledEnd);
  if (!item.scheduledOn || !block) return undefined;
  return `${DateTime.fromISO(item.scheduledOn).toFormat("ccc")} ${block}`;
};

/* ------------------------------------------------------------------------ */
/* The weekly review: the week's arithmetic                                  */
/* ------------------------------------------------------------------------ */

/** A weekly review's guided steps, in order. */
export const WEEKLY_STEPS = [
  "Look back",
  "Highlights",
  "Reflect",
  "Plan next week",
  "Wrap up",
] as const;

/** The days of a week from its Monday: seven, or five for the work week. */
export const daysOfWeek = (monday: DateTime, count = 7): DateTime[] =>
  Array.from({ length: count }, (_, i) =>
    monday.startOf("day").plus({ days: i }),
  );

/** A plan item that may hold a block of time on a day. */
export type BlockedItem = {
  id: string;
  title: string;
  status: ReviewPlanItem["status"];
  scheduledOn?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
};

/** An item's block of time as a span on its day, if it has one. */
export const blockedSpan = (item: BlockedItem): MeetingSpan | undefined => {
  if (!item.scheduledOn || !item.scheduledStart || !item.scheduledEnd) {
    return undefined;
  }
  const at = (clock: string) =>
    DateTime.fromISO(`${item.scheduledOn}T${clock}`);
  const start = at(item.scheduledStart);
  return {
    meeting: {
      id: item.id,
      subject: item.title,
      startTime: start.toISO()!,
      isAllDay: false,
      isDeleted: false,
      status: "Busy",
    },
    start,
    end: at(item.scheduledEnd),
  };
};

/** The spans clipped to a window of the day, those outside it left out. */
const clipTo = (
  spans: MeetingSpan[],
  day: DateTime,
  fromHour: number,
  toHour: number,
): MeetingSpan[] => {
  const from = day.startOf("day").set({ hour: fromHour });
  const to = day.startOf("day").set({ hour: toHour });
  return spans
    .map((span) => ({
      ...span,
      start: span.start < from ? from : span.start,
      end: span.end > to ? to : span.end,
    }))
    .filter((span) => span.end > span.start);
};

/** How full a day is, by the share of its working hours taken. */
export type LoadLevel = "light" | "moderate" | "heavy";

/** A day of the week as its time card and the plan's grid show it. */
export type DayLoad = {
  day: string;
  /** Timed meetings that take time, and the minutes they cover. */
  meetings: number;
  meetingMinutes: number;
  /** Minutes blocked for priorities. */
  focusMinutes: number;
  /** The share of the working hours taken by both, overlaps once, 0 to 1. */
  load: number;
  level: LoadLevel;
};

/** The level a share of the working day reads as. */
export const loadLevel = (load: number): LoadLevel =>
  load < 0.4 ? "light" : load < 0.7 ? "moderate" : "heavy";

/**
 * Each day's meetings, focus blocks and load: the share of the working
 * hours, `fromHour` to `toHour`, that meetings and blocks take between
 * them. Dropped and carried items hold no time.
 */
export const weekLoad = (
  meetings: ReviewMeeting[],
  days: DateTime[],
  items: BlockedItem[] = [],
  fromHour = 9,
  toHour = 17,
): DayLoad[] =>
  days.map((day) => {
    const date = day.toISODate()!;
    const spans = meetingSpans(meetings, day);
    const blocks = items
      .filter(
        (i) =>
          i.scheduledOn === date &&
          i.status !== "dropped" &&
          i.status !== "carried",
      )
      .map(blockedSpan)
      .filter((span): span is MeetingSpan => span !== undefined);
    const taken = clipTo([...spans, ...blocks], day, fromHour, toHour).sort(
      (a, b) => a.start.toMillis() - b.start.toMillis(),
    );
    const load = Math.min(1, busyMinutes(taken) / ((toHour - fromHour) * 60));
    return {
      day: date,
      meetings: spans.length,
      meetingMinutes: busyMinutes(spans),
      focusMinutes: busyMinutes(
        [...blocks].sort((a, b) => a.start.toMillis() - b.start.toMillis()),
      ),
      load: Math.round(load * 100) / 100,
      level: loadLevel(load),
    };
  });

/** A plan item with its place in a chain of carries. */
export type ChainItem = ReviewPlanItem & {
  carryCount: number;
  carriedFromId?: string;
};

/**
 * What slipped in a week: for each chain of carries, its last link in the
 * week, when the chain was carried at least once (the link is a copy, or
 * was itself carried out of the week); and anything planned for a day
 * before `today` still left open. In day order, then each day's order.
 */
export const slippedItems = <T extends ChainItem>(
  items: T[],
  monday: DateTime,
  today: string,
): T[] => {
  const days = daysOfWeek(monday).map((d) => d.toISODate()!);
  const inWeek = items.filter((i) => days.includes(i.periodStart));
  // An item whose copy is also in the week is not the chain's last link.
  const carriedOn = new Set(
    inWeek.map((i) => i.carriedFromId).filter((id) => id !== undefined),
  );
  const slipped = inWeek.filter(
    (i) =>
      !carriedOn.has(i.id) &&
      (i.carryCount > 0 ||
        i.status === "carried" ||
        (i.status === "open" && i.periodStart < today)),
  );
  return days.flatMap((day) => itemsOf(slipped, day));
};

/** A decision on a slipped item, as the weekly Look back offers it. */
export type WeekTriage = "done" | "next" | "later" | "drop";

/** The decision a slipped item's status shows: carried on is next week. */
export const weekTriageOf = (
  status: ReviewPlanItem["status"],
): WeekTriage | undefined =>
  ({
    open: undefined,
    done: "done",
    carried: "next",
    someday: "later",
    dropped: "drop",
  })[status] as WeekTriage | undefined;

/** A rating's line on the week's chart: null where a day has none. */
export type RatingSeries = {
  key: RatingField["key"];
  label: string;
  data: (number | null)[];
};

type Ratings = Partial<Record<RatingField["key"], number | null>>;

/**
 * The chart of a week's daily ratings: one series per rating, a value per
 * day, and a gap (null) for a day with no review or no rating, so the line
 * breaks there instead of joining across it.
 */
export const ratingSeries = (
  periods: { periodStart: string; ratings: Ratings }[],
  days: string[],
  fields: RatingField[],
): RatingSeries[] =>
  fields.map((field) => ({
    key: field.key,
    label: field.label,
    data: days.map((day) => {
      const value = periods.find((p) => p.periodStart === day)?.ratings[
        field.key
      ];
      return value ?? null;
    }),
  }));

/** A rating's average this period against the one before. */
export type RatingChange = {
  key: RatingField["key"];
  label: string;
  value?: number;
  previous?: number;
  change?: number;
};

/** Each rating's average against the period before's, and the change. */
export const ratingChanges = (
  averages: Ratings,
  previous: Ratings,
  fields: RatingField[],
): RatingChange[] =>
  fields.map((field) => {
    const value = averages[field.key] ?? undefined;
    const before = previous[field.key] ?? undefined;
    return {
      key: field.key,
      label: field.label,
      value,
      previous: before,
      change:
        value !== undefined && before !== undefined
          ? Math.round((value - before) * 100) / 100
          : undefined,
    };
  });

/** A prompt and every answer the week's reviews gave it, by day. */
export type PromptAnswers<P, A> = {
  prompt: P;
  answers: { day: string; answer: A }[];
};

/**
 * The week's daily answers grouped under their prompts, for Highlights:
 * the section's prompts in their order, archived ones only where some day
 * answered them, each day's answers in day order, a list's items in theirs.
 */
export const answersByPrompt = <
  P extends { id: string; section: string; archived?: boolean },
  A extends { promptId: string; body: string; position?: number },
>(
  prompts: P[],
  reviews: { periodStart: string; answers: A[] }[],
  section = "reflect",
): PromptAnswers<P, A>[] => {
  const ordered = [...reviews].sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart),
  );
  return prompts
    .filter((p) => p.section === section)
    .map((prompt) => ({
      prompt,
      answers: ordered.flatMap((review) =>
        review.answers
          .filter((a) => a.promptId === prompt.id && a.body.trim())
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((answer) => ({ day: review.periodStart, answer })),
      ),
    }))
    .filter((group) => !group.prompt.archived || group.answers.length > 0);
};

/**
 * A review's answered prompts of a section, in the prompts' order, each
 * with its answers in their order: a text prompt's one, a list's items.
 */
export const answeredPrompts = <
  P extends { id: string; section: string },
  A extends { promptId: string; position: number },
>(
  prompts: P[],
  answers: A[],
  section: string,
): { prompt: P; answers: A[] }[] =>
  prompts
    .filter((p) => p.section === section)
    .map((prompt) => ({
      prompt,
      answers: answers
        .filter((a) => a.promptId === prompt.id)
        .sort((a, b) => a.position - b.position),
    }))
    .filter((pair) => pair.answers.length > 0);
