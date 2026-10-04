import { DateTime } from "luxon";

export const MeetingStatusTypes = [
  "Free",
  "Busy",
  "Tentative",
  "OOF",
  "WorkingElsewhere",
  "NoData",
] as const;

/** The statuses above, as the keys of MeetingStatusStatistics. */
export type MeetingStatusType = (typeof MeetingStatusTypes)[number];

export const config: Record<string, { color: string }> = {
  Free: {
    color: "#32485c",
  },
  Busy: {
    color: "#67598c",
  },
  Tentative: {
    color: "#c05a91",
  },
  OOF: {
    color: "#df5b84",
  },
  WorkingElsewhere: {
    color: "#ff7356",
  },
  NoData: {
    color: "#ffa600",
  },
};

export const getColorForType = (type: string) => {
  return config[type].color;
};

/** Where an organizer's photo lives, by alias: the work directory's. */
const AVATAR_BASE = "https://cdn.internal.ncfritz.net/amzn/avatar";

/** Who organized a meeting, as far as Minerva knows them. */
export interface MeetingOrganizer {
  /** A name to show: theirs when known, else their address. */
  name: string;
  email?: string;
  /** A photo, when Minerva knows their alias. */
  avatar?: string;
}

/**
 * A meeting's organizer for display. A meeting synced from a calendar
 * names its organizer by address only, and some name none at all.
 */
export const organizerOf = (meeting: {
  organizer?: {
    email: string;
    alias?: string;
    givenName?: string;
    surname?: string;
  };
  organizerEmail?: string;
}): MeetingOrganizer => {
  const person = meeting.organizer;
  const email = person?.email || meeting.organizerEmail || undefined;
  const name = [person?.givenName, person?.surname]
    .filter((part) => part && part.trim() !== "")
    .join(" ");
  return {
    name: name || email || "Unknown organizer",
    email,
    avatar: person?.alias ? `${AVATAR_BASE}/${person.alias}.jpg` : undefined,
  };
};

/** The meeting pages' three views. */
export type MeetingsView = "day" | "week" | "month";

/** What a view shows: the days it fetches, and the period its numbers are for. */
export interface MeetingsPeriod {
  /** The first day fetched, at midnight. */
  start: DateTime;
  /** How many whole days are fetched from it. */
  days: number;
  /** The period itself: a month's grid fetches the edges of its neighbours. */
  from: DateTime;
  /** Exclusive. */
  to: DateTime;
}

/**
 * A view's days around a date. Weeks are ISO weeks, Monday to Sunday, as
 * the W-numbered URLs are; a month shows the whole weeks it touches, and
 * no more (its calendar does not pad to six).
 */
export const periodOf = (
  view: MeetingsView,
  date: DateTime,
): MeetingsPeriod => {
  const day = date.startOf("day");
  if (view === "day") {
    return { start: day, days: 1, from: day, to: day.plus({ days: 1 }) };
  }
  if (view === "week") {
    const monday = day.startOf("week");
    return {
      start: monday,
      days: 7,
      from: monday,
      to: monday.plus({ weeks: 1 }),
    };
  }
  const from = day.startOf("month");
  const to = from.plus({ months: 1 });
  const start = from.startOf("week");
  const end = to.minus({ days: 1 }).endOf("week").startOf("day");
  // Calendar days, so a change to or from summer time is still a whole day.
  const days = Math.round(end.diff(start, "days").days) + 1;
  return { start, days, from, to };
};

/** The page that shows a view of a date. */
export const meetingsHref = (view: MeetingsView, date: DateTime): string => {
  if (view === "day") return `/minerva/meetings/${date.toFormat("yyyy/MM/dd")}`;
  if (view === "week") {
    // The ISO week's own year: 29 December can be in week 1.
    return `/minerva/meetings/${date.toFormat("kkkk")}/W${date.toFormat("WW")}`;
  }
  return `/minerva/meetings/${date.toFormat("yyyy/MM")}`;
};

/** The same view one period earlier or later. */
export const stepPeriod = (
  view: MeetingsView,
  date: DateTime,
  by: -1 | 1,
): DateTime =>
  view === "day"
    ? date.plus({ days: by })
    : view === "week"
      ? date.plus({ weeks: by })
      : date.startOf("month").plus({ months: by });

/** A period's meetings in numbers. */
export interface MeetingsStatistics {
  /** Timed meetings that were not cancelled. */
  meetings: number;
  /** Their minutes inside the period. */
  minutes: number;
  /** Of those, by calendar status. */
  byStatus: Record<string, number>;
  cancelled: number;
}

/**
 * The numbers above for the meetings that touch a period. All-day items
 * are not meetings; a meeting's minutes are counted only inside the
 * period, so one across midnight is split between its days.
 */
export const periodStatistics = (
  items: {
    startTime: string;
    endTime?: string;
    isAllDay: boolean;
    isCancelled: boolean;
    status: string;
  }[],
  from: DateTime,
  to: DateTime,
): MeetingsStatistics => {
  const statistics: MeetingsStatistics = {
    meetings: 0,
    minutes: 0,
    byStatus: {},
    cancelled: 0,
  };
  for (const item of items) {
    if (item.isAllDay) continue;
    const start = DateTime.fromISO(item.startTime);
    const end = item.endTime ? DateTime.fromISO(item.endTime) : start;
    if (start >= to || (end > start ? end <= from : start < from)) {
      continue;
    }
    if (item.isCancelled) {
      statistics.cancelled += 1;
      continue;
    }
    statistics.meetings += 1;
    statistics.byStatus[item.status] =
      (statistics.byStatus[item.status] ?? 0) + 1;
    const inside =
      DateTime.min(end, to).toMillis() - DateTime.max(start, from).toMillis();
    statistics.minutes += Math.max(0, Math.round(inside / 60_000));
  }
  return statistics;
};

/** Minutes as hours and minutes: 1h 30m, 45m, 0m. */
export const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};
