import {
  LABELS,
  type Level,
  type OnAirStatus,
  toOnAirStatus,
} from "@ncfritz/olympus-availability";

/*
 * What the screens read from the API's availability (ADR 0029): the status
 * now and when it changes, today's strip, what is up next, a day laid out,
 * the overrides by day, and the lengths New override offers. Pure: the
 * shapes below are the SDK's, restated so the unit tests reach no SDK.
 */

export type Slot = { startTime: string; status: Level };

export type Meeting = {
  meetingId: string;
  subject?: string;
  startTime: string;
  endTime: string;
  /** Busy, Tentative, Free, OOF or WorkingElsewhere. */
  calendarStatus: string;
  /** The level it counts for: the user's, else its calendar status's. */
  status: Level;
  overridden: boolean;
  counted: boolean;
};

export type Block = {
  id: string;
  startTime: string;
  endTime: string;
  status: Level;
  label?: string;
};

export type Availability = {
  slots: Slot[];
  meetings: Meeting[];
  blocks: Block[];
};

const MINUTE = 60 * 1000;
const SLOT_MS = 15 * MINUTE;
const DAY_MS = 24 * 60 * MINUTE;

const ms = (iso: string): number => Date.parse(iso);

/* ------------------------------------------------------------------ */
/* Days                                                                */
/* ------------------------------------------------------------------ */

/** Local midnight of the day `at` falls in. */
export const startOfDay = (at: Date | number): Date => {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day;
};

/** `days` local days after `day`, at the same wall-clock time. */
export const addDays = (day: Date, days: number): Date => {
  const next = new Date(day);
  next.setDate(next.getDate() + days);
  return next;
};

/** What the app loads: a week back, two weeks ahead, as the site's drawer does. */
export const loadWindow = (now: Date): { start: Date; end: Date } => {
  const today = startOfDay(now);
  return { start: addDays(today, -7), end: addDays(today, 15) };
};

/** The Monday-to-Sunday week `day` falls in. */
export const weekOf = (day: Date): Date[] => {
  const start = startOfDay(day);
  const fromMonday = (start.getDay() + 6) % 7;
  const monday = addDays(start, -fromMonday);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
};

export const sameDay = (a: Date | number, b: Date | number): boolean =>
  startOfDay(a).getTime() === startOfDay(b).getTime();

/* ------------------------------------------------------------------ */
/* Words                                                               */
/* ------------------------------------------------------------------ */

/** 11:45, 2:00: the clock the lists use, without AM or PM. */
export const clock = (at: Date | number): string => {
  const date = new Date(at);
  const hours = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
  return `${hours}:${String(date.getMinutes()).padStart(2, "0")}`;
};

/** 11:45 AM: where a time stands alone. */
export const clockWithPeriod = (at: Date | number): string =>
  `${clock(at)} ${new Date(at).getHours() < 12 ? "AM" : "PM"}`;

/** 45 min, 1 hr, 1 hr 30 min. */
export const duration = (lengthMs: number): string => {
  const minutes = Math.max(0, Math.round(lengthMs / MINUTE));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
};

/** 33:42, or 1:05:12 past the hour: the countdown. */
export const countdown = (remainingMs: number): string => {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}`
    : `${minutes}:${ss}`;
};

/* ------------------------------------------------------------------ */
/* Now                                                                 */
/* ------------------------------------------------------------------ */

/** A run of slots at one level. */
export type Segment = { start: number; end: number; level: Level };

/** The slots as runs: neighbouring slots at the same level are one. */
export const segments = (slots: readonly Slot[]): Segment[] => {
  const runs: Segment[] = [];
  for (const slot of slots) {
    const start = ms(slot.startTime);
    const last = runs.at(-1);
    if (
      last !== undefined &&
      last.level === slot.status &&
      last.end === start
    ) {
      last.end = start + SLOT_MS;
    } else {
      runs.push({ start, end: start + SLOT_MS, level: slot.status });
    }
  }
  return runs;
};

/** What makes the level what it is: an override, a meeting, or neither. */
export type Cause =
  { kind: "block"; block: Block } | { kind: "meeting"; meeting: Meeting };

const covers = (item: { startTime: string; endTime: string }, at: number) =>
  ms(item.startTime) <= at && at < ms(item.endTime);

/**
 * Why the level at `at` is `level`. Blocks win over meetings (ADR 0029), so
 * a block covering the moment is the cause; else the counted meeting at that
 * level, the longest-running first.
 */
export const causeAt = (
  availability: Availability,
  at: number,
  level: Level,
): Cause | undefined => {
  const blocks = availability.blocks.filter((block) => covers(block, at));
  const block =
    blocks.find((candidate) => candidate.status === level) ?? blocks[0];
  if (block !== undefined) return { kind: "block", block };
  const meeting = availability.meetings
    .filter(
      (candidate) =>
        candidate.counted &&
        candidate.status === level &&
        covers(candidate, at),
    )
    .sort((a, b) => ms(a.startTime) - ms(b.startTime))[0];
  return meeting === undefined ? undefined : { kind: "meeting", meeting };
};

export type NowState = {
  level: Level;
  status: OnAirStatus;
  /** The run the moment is in. */
  since: number;
  until: number;
  /** How far through the run, 0 to 1: the ring. */
  progress: number;
  cause?: Cause;
  next?: { level: Level; status: OnAirStatus; at: number; cause?: Cause };
};

/** The status now, why, how long it lasts, and what follows. */
export const nowState = (
  availability: Availability,
  now: Date,
): NowState | undefined => {
  const at = now.getTime();
  const runs = segments(availability.slots);
  const index = runs.findIndex((run) => run.start <= at && at < run.end);
  const run = runs.at(index);
  if (index < 0 || run === undefined) return undefined;
  const following = runs.at(index + 1);
  const cause = causeAt(availability, at, run.level);
  const nextCause =
    following === undefined
      ? undefined
      : causeAt(availability, following.start, following.level);
  return {
    level: run.level,
    status: toOnAirStatus(run.level),
    since: run.start,
    until: run.end,
    progress: Math.min(
      1,
      Math.max(0, (at - run.start) / (run.end - run.start)),
    ),
    ...(cause === undefined ? {} : { cause }),
    ...(following === undefined
      ? {}
      : {
          next: {
            level: following.level,
            status: toOnAirStatus(following.level),
            at: following.start,
            ...(nextCause === undefined ? {} : { cause: nextCause }),
          },
        }),
  };
};

/** What a cause is called in a line: the meeting's subject, the block's label. */
export const causeTitle = (cause: Cause | undefined): string | undefined => {
  if (cause === undefined) return undefined;
  return cause.kind === "block"
    ? (cause.block.label ?? "Override")
    : (cause.meeting.subject ?? "Untitled meeting");
};

/* ------------------------------------------------------------------ */
/* The day strip                                                       */
/* ------------------------------------------------------------------ */

/** The working day the API reads against by default: 08:00 to 18:00. */
export const WORKING_DAY = { startHour: 8, endHour: 18 } as const;

export type StripPart = { status: OnAirStatus; fraction: number };

/**
 * Today's working day as parts of the strip, in order, with where now falls
 * (undefined outside it). Time with no slot is clear.
 */
export const dayStrip = (
  slots: readonly Slot[],
  now: Date,
): { parts: StripPart[]; nowFraction?: number } => {
  const day = startOfDay(now);
  const from = day.getTime() + WORKING_DAY.startHour * 60 * MINUTE;
  const to = day.getTime() + WORKING_DAY.endHour * 60 * MINUTE;
  const span = to - from;
  const parts: StripPart[] = [];
  const push = (status: OnAirStatus, length: number) => {
    if (length <= 0) return;
    const last = parts.at(-1);
    if (last !== undefined && last.status === status) {
      last.fraction += length / span;
    } else {
      parts.push({ status, fraction: length / span });
    }
  };
  let cursor = from;
  for (const run of segments(slots)) {
    const start = Math.max(run.start, from);
    const end = Math.min(run.end, to);
    if (end <= start) continue;
    push("clear", start - cursor);
    push(toOnAirStatus(run.level), end - start);
    cursor = end;
  }
  push("clear", to - cursor);
  const at = now.getTime();
  return at >= from && at < to
    ? { parts, nowFraction: (at - from) / span }
    : { parts };
};

/* ------------------------------------------------------------------ */
/* Items: meetings and overrides in a list                             */
/* ------------------------------------------------------------------ */

export type Item = {
  kind: "meeting" | "block";
  id: string;
  start: number;
  end: number;
  title: string;
  /** The status its border shows. */
  status: OnAirStatus;
  /** The second line: why it is that status, and for how long. */
  detail: string;
};

const meetingItem = (meeting: Meeting): Item => {
  const start = ms(meeting.startTime);
  const end = ms(meeting.endTime);
  const status = toOnAirStatus(meeting.status);
  return {
    kind: "meeting",
    id: meeting.meetingId,
    start,
    end,
    title: meeting.subject ?? "Untitled meeting",
    status,
    detail: meeting.overridden
      ? `${meeting.calendarStatus} → set to ${LABELS[status]}`
      : `${meeting.calendarStatus} · ${duration(end - start)}`,
  };
};

const blockItem = (block: Block): Item => {
  const start = ms(block.startTime);
  const end = ms(block.endTime);
  const status = toOnAirStatus(block.status);
  return {
    kind: "block",
    id: block.id,
    start,
    end,
    title: block.label ?? "Override",
    status,
    detail: `Override · ${LABELS[status]} · ${duration(end - start)}`,
  };
};

const byStart = (a: Item, b: Item) => a.start - b.start || a.end - b.end;

/** Meetings and overrides that touch [from, to), by start. */
export const itemsBetween = (
  availability: Availability,
  from: number,
  to: number,
): Item[] =>
  [
    ...availability.meetings.map(meetingItem),
    ...availability.blocks.map(blockItem),
  ]
    .filter((item) => item.start < to && item.end > from)
    .sort(byStart);

/** Up next: what starts later today, by start. */
export const upNext = (availability: Availability, now: Date): Item[] => {
  const at = now.getTime();
  const end = addDays(startOfDay(now), 1).getTime();
  return itemsBetween(availability, at, end).filter((item) => item.start > at);
};

/* ------------------------------------------------------------------ */
/* A day laid out                                                      */
/* ------------------------------------------------------------------ */

export type Placed = Item & { column: number; columns: number };

/**
 * Side by side where items overlap: each item takes the first free column
 * of the cluster it belongs to, and every item in a cluster knows how many
 * columns the cluster needs.
 */
export const layoutColumns = (items: readonly Item[]): Placed[] => {
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    const columns = Math.max(1, ...cluster.map((item) => item.column + 1));
    for (const item of cluster) item.columns = columns;
    cluster = [];
  };
  for (const item of [...items].sort(byStart)) {
    if (item.start >= clusterEnd) {
      close();
      clusterEnd = -Infinity;
    }
    const busy = new Set(
      cluster.filter((other) => other.end > item.start).map((o) => o.column),
    );
    let column = 0;
    while (busy.has(column)) column += 1;
    const next: Placed = { ...item, column, columns: 1 };
    cluster.push(next);
    placed.push(next);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  close();
  return placed;
};

/* ------------------------------------------------------------------ */
/* Overrides by day                                                    */
/* ------------------------------------------------------------------ */

export type DayGroup = { day: Date; items: Item[] };

const groupByDay = (items: Item[]): DayGroup[] => {
  const groups: DayGroup[] = [];
  for (const item of items) {
    const day = startOfDay(item.start);
    const last = groups.at(-1);
    if (last !== undefined && last.day.getTime() === day.getTime()) {
      last.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
  }
  return groups;
};

/**
 * The overrides, upcoming (not yet over) soonest first and past most recent
 * first, each grouped by the day it starts.
 */
export const overridesByDay = (
  blocks: readonly Block[],
  now: Date,
): { upcoming: DayGroup[]; past: DayGroup[] } => {
  const at = now.getTime();
  const items = blocks.map(blockItem);
  return {
    upcoming: groupByDay(items.filter((item) => item.end > at).sort(byStart)),
    past: groupByDay(
      items.filter((item) => item.end <= at).sort((a, b) => byStart(b, a)),
    ),
  };
};

/** Today, Tomorrow, Yesterday, else Friday, Oct 16. */
export const dayTitle = (day: Date, now: Date): string => {
  const offset = Math.round(
    (startOfDay(day).getTime() - startOfDay(now).getTime()) / DAY_MS,
  );
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  const weekday = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ].at(day.getDay());
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ].at(day.getMonth());
  return `${weekday}, ${month} ${day.getDate()}`;
};

/* ------------------------------------------------------------------ */
/* New override                                                        */
/* ------------------------------------------------------------------ */

export type LengthChoice = {
  key: "30m" | "1h" | "2h" | "meeting" | "day";
  label: string;
  end: number;
};

/**
 * The lengths New override offers from `now`: fixed spans, until the meeting
 * now in progress ends (when there is one), and the rest of the working day
 * (to midnight once it is over).
 */
export const lengthChoices = (
  availability: Availability,
  now: Date,
): LengthChoice[] => {
  const at = now.getTime();
  const choices: LengthChoice[] = [
    { key: "30m", label: "30 min", end: at + 30 * MINUTE },
    { key: "1h", label: "1 hr", end: at + 60 * MINUTE },
    { key: "2h", label: "2 hr", end: at + 120 * MINUTE },
  ];
  const meeting = availability.meetings
    .filter((candidate) => candidate.counted && covers(candidate, at))
    .sort((a, b) => ms(b.endTime) - ms(a.endTime))[0];
  if (meeting !== undefined) {
    choices.push({
      key: "meeting",
      label: "Until meeting ends",
      end: ms(meeting.endTime),
    });
  }
  const day = startOfDay(now);
  const workEnd = day.getTime() + WORKING_DAY.endHour * 60 * MINUTE;
  choices.push({
    key: "day",
    label: "Rest of day",
    end: at < workEnd ? workEnd : addDays(day, 1).getTime(),
  });
  return choices;
};

/** The meetings an override from `start` to `end` would cover, by start. */
export const covered = (
  availability: Availability,
  start: number,
  end: number,
): Meeting[] =>
  availability.meetings
    .filter(
      (meeting) => ms(meeting.startTime) < end && ms(meeting.endTime) > start,
    )
    .sort((a, b) => ms(a.startTime) - ms(b.startTime));
