import { AvailabilityLevel } from "@ncfritz/olympus-model";

/**
 * How a user's availability is worked out (ADR 0029), ported from the
 * calendar sync agent's AvailabilityService so the drawer shows what it
 * showed: 15-minute slots, each the highest level of what overlaps it,
 * blocks over meetings, and only overrides outside the working day. No I/O.
 */

export const SLOT_MS = 15 * 60 * 1000;
/** The most a request may span: a quarter's worth of slots is cheap. */
export const MAX_RANGE_MS = 92 * 24 * 60 * 60 * 1000;

const PRECEDENCE: Record<AvailabilityLevel, number> = {
  [AvailabilityLevel.None]: 0,
  [AvailabilityLevel.Free]: 1,
  [AvailabilityLevel.Interruptable]: 2,
  [AvailabilityLevel.Busy]: 3,
};

export const LEVELS: readonly AvailabilityLevel[] = [
  AvailabilityLevel.None,
  AvailabilityLevel.Free,
  AvailabilityLevel.Interruptable,
  AvailabilityLevel.Busy,
];

export const isLevel = (value: unknown): value is AvailabilityLevel =>
  LEVELS.includes(value as AvailabilityLevel);

/** The highest of `levels`, which must not be empty. */
export const highest = (levels: AvailabilityLevel[]): AvailabilityLevel =>
  levels.reduce((best, level) =>
    PRECEDENCE[level] > PRECEDENCE[best] ? level : best,
  );

/**
 * The level a meeting's free/busy status gives (the meetings table's
 * vocabulary). Out of office and working elsewhere mean not here to
 * interrupt; a status the table does not know counts as busy, the safe
 * side for a sign that says whether to come in.
 */
export const levelOfMeetingStatus = (status: string): AvailabilityLevel => {
  switch (status) {
    case "Free":
      return AvailabilityLevel.Free;
    case "Tentative":
      return AvailabilityLevel.Interruptable;
    case "OOF":
    case "WorkingElsewhere":
      return AvailabilityLevel.None;
    default:
      return AvailabilityLevel.Busy;
  }
};

/** Something with a level over a span of time, in epoch milliseconds. */
export type Timed = {
  start: number;
  end: number;
  level: AvailabilityLevel;
};

export type TimedMeeting = Timed & {
  /** The user set its level, so it shows through outside the working day. */
  overridden: boolean;
};

export type WorkingDay = {
  /** Minutes after midnight, in `timezone`. */
  startMinutes: number;
  /** Minutes after midnight, exclusive. */
  endMinutes: number;
  includeWeekends: boolean;
  /** An IANA name. */
  timezone: string;
};

export const DEFAULT_WORKING_DAY: WorkingDay = {
  startMinutes: 8 * 60,
  endMinutes: 18 * 60,
  includeWeekends: false,
  timezone: "UTC",
};

/** `HH:mm` as minutes after midnight, or undefined if it is not one. */
export const parseTimeOfDay = (value: string): number | undefined => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
};

/** Whether `timezone` is an IANA name this runtime knows. */
export const isTimeZone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/** `epochMs` rounded down to its 15-minute slot. */
export const slotStartOf = (epochMs: number): number =>
  Math.floor(epochMs / SLOT_MS) * SLOT_MS;

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Whether a moment is in the working day, read in the day's time zone.
 * One formatter per call of the returned function's maker: building one
 * per slot (thousands) is needlessly slow.
 */
export const workingDayTest = (
  day: WorkingDay,
): ((epochMs: number) => boolean) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: day.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return (epochMs) => {
    const parts = formatter.formatToParts(new Date(epochMs));
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    const weekday = WEEKDAYS[part("weekday")]!;
    // Some ICU builds write midnight as 24 with hour12 off.
    const minutes = (Number(part("hour")) % 24) * 60 + Number(part("minute"));
    if ((weekday === 0 || weekday === 6) && !day.includeWeekends) {
      return false;
    }
    return minutes >= day.startMinutes && minutes < day.endMinutes;
  };
};

/**
 * One slot's level: any block overlapping it wins (the highest of them);
 * failing that, the highest of the meetings overlapping it; failing that,
 * `fallback`.
 */
const slotLevel = (
  meetings: Timed[],
  blocks: Timed[],
  start: number,
  end: number,
  fallback: AvailabilityLevel,
): AvailabilityLevel => {
  const overlaps = (t: Timed) => t.start < end && t.end > start;
  const inBlocks = blocks.filter(overlaps);
  if (inBlocks.length) return highest(inBlocks.map((b) => b.level));
  const inMeetings = meetings.filter(overlaps);
  return inMeetings.length ? highest(inMeetings.map((m) => m.level)) : fallback;
};

/**
 * Every 15-minute slot from `start` (on a slot boundary) to `end`. In the
 * working day: what overlaps, else `free`. Outside it: only blocks and
 * meetings whose level the user set count, else `none`.
 */
export const availabilitySlots = (
  start: number,
  end: number,
  meetings: TimedMeeting[],
  blocks: Timed[],
  day: WorkingDay = DEFAULT_WORKING_DAY,
): { start: number; level: AvailabilityLevel }[] => {
  const working = workingDayTest(day);
  const overridden = meetings.filter((m) => m.overridden);
  const slots: { start: number; level: AvailabilityLevel }[] = [];
  for (let at = start; at < end; at += SLOT_MS) {
    const level = working(at)
      ? slotLevel(meetings, blocks, at, at + SLOT_MS, AvailabilityLevel.Free)
      : slotLevel(overridden, blocks, at, at + SLOT_MS, AvailabilityLevel.None);
    slots.push({ start: at, level });
  }
  return slots;
};
