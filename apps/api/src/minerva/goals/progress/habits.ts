import { HabitFrequency } from "@ncfritz/olympus-model";
import moment from "moment";
import type { IsoDate } from "../../utils/localDates";
import type { EngineHabitLog, EngineHabitRule } from "./types";

/** How many periods back adherence looks: four weeks of days, four weeks, three months. */
const WINDOW: Record<HabitFrequency, number> = {
  [HabitFrequency.Daily]: 28,
  [HabitFrequency.Weekdays]: 28,
  [HabitFrequency.Weekly]: 4,
  [HabitFrequency.Monthly]: 3,
};

/** One period of a habit: a day, an ISO week or a calendar month. */
export type Period = {
  start: IsoDate;
  end: IsoDate;
  /** Occurrences the period can hold, given the rule and the goal's start. */
  capacity: number;
  /** Logs that count, capped at the capacity. */
  done: number;
  /** Whether the last day looked at (usually today) falls in this period. */
  current: boolean;
};

/** What a habit's logs come to, as of today. */
export type HabitSummary = {
  /** Done over due across the window, 0 to 100; absent when nothing was due yet. */
  adherence?: number;
  done: number;
  due: number;
  /** Periods in a row met, back from today. A current period not met yet does not break it. */
  currentStreak: number;
  bestStreak: number;
  /** In the current period: done, and how many it holds. */
  periodDone: number;
  periodCapacity: number;
};

const day = (date: IsoDate) => moment.utc(date, "YYYY-MM-DD");
const iso = (m: moment.Moment) => m.format("YYYY-MM-DD");

/** Whether a log counts: marked done, or its quantity reached the target. */
export const isMet = (log: EngineHabitLog, rule: EngineHabitRule): boolean =>
  log.done ||
  (rule.quantityTarget !== undefined &&
    (log.quantity ?? 0) >= rule.quantityTarget);

/** The period of a frequency that contains a date. */
export const periodBounds = (
  frequency: HabitFrequency,
  date: IsoDate,
): { start: IsoDate; end: IsoDate } => {
  const d = day(date);
  switch (frequency) {
    case HabitFrequency.Weekly:
      return {
        start: iso(d.clone().startOf("isoWeek")),
        end: iso(d.clone().endOf("isoWeek")),
      };
    case HabitFrequency.Monthly:
      return {
        start: iso(d.clone().startOf("month")),
        end: iso(d.clone().endOf("month")),
      };
    default:
      return { start: date, end: date };
  }
};

/**
 * Every period from the one holding the goal's start to the one holding
 * `today` (the last day looked at), oldest first, with what each holds and
 * what was done in it up to that day.
 */
export const periods = (
  rule: EngineHabitRule,
  logs: EngineHabitLog[],
  startDate: IsoDate,
  today: IsoDate,
): Period[] => {
  const met = new Set(
    logs
      .filter(
        (log) => log.date >= startDate && log.date <= today && isMet(log, rule),
      )
      .map((log) => log.date),
  );
  const result: Period[] = [];
  let { start, end } = periodBounds(rule.frequency, startDate);
  while (start <= today) {
    const from = start < startDate ? startDate : start;
    const to = end > today ? today : end;
    const current = today >= start && today <= end;
    let capacity: number;
    if (rule.frequency === HabitFrequency.Daily) capacity = 1;
    else if (rule.frequency === HabitFrequency.Weekdays) {
      capacity = (rule.weekdays ?? []).includes(day(start).isoWeekday())
        ? 1
        : 0;
    } else {
      // Days the period has from the goal's start: a goal starting on a
      // Thursday cannot be held to five runs in that first week.
      const available = day(end).diff(day(from), "days") + 1;
      capacity = Math.min(rule.timesPerPeriod, available);
    }
    let count = 0;
    for (let d = day(from); iso(d) <= to; d.add(1, "day")) {
      if (met.has(iso(d))) count += 1;
    }
    result.push({
      start,
      end,
      capacity,
      done: Math.min(count, capacity),
      current,
    });
    const next = iso(day(end).add(1, "day"));
    ({ start, end } = periodBounds(rule.frequency, next));
  }
  return result;
};

/**
 * A habit's adherence and streaks as of today, by its current rule (a
 * rule's history is not kept, so a changed rule is applied to the past
 * too). The current period is not counted against the habit until it is
 * over: it is due only as much as it has been done.
 *
 * A habit that stopped (closed, or past its due date) on `until` is
 * measured as of that day. The period it stopped in counts in full when
 * `until` was that period's last day, and otherwise only as far as done.
 */
export const habitSummary = (
  rule: EngineHabitRule,
  logs: EngineHabitLog[],
  startDate: IsoDate,
  today: IsoDate,
  until?: IsoDate,
): HabitSummary => {
  const stopped = until !== undefined && until < today;
  const asOf = stopped ? until : today;
  const over = stopped && periodBounds(rule.frequency, asOf).end === asOf;
  return summarise(rule, logs, startDate, asOf, over);
};

const summarise = (
  rule: EngineHabitRule,
  logs: EngineHabitLog[],
  startDate: IsoDate,
  today: IsoDate,
  over: boolean,
): HabitSummary => {
  if (today < startDate) {
    return {
      done: 0,
      due: 0,
      currentStreak: 0,
      bestStreak: 0,
      periodDone: 0,
      periodCapacity: 0,
    };
  }
  const all = periods(rule, logs, startDate, today);
  if (over) all[all.length - 1].current = false;
  const window = all.slice(-WINDOW[rule.frequency]);
  let done = 0;
  let due = 0;
  for (const p of window) {
    done += p.done;
    due += p.current ? p.done : p.capacity;
  }

  // A period with nothing due (a day off a weekdays habit) neither counts
  // nor breaks a streak.
  const counted = all.filter((p) => p.capacity > 0);
  const met = (p: Period) => p.done >= p.capacity;
  let best = 0;
  let run = 0;
  for (const p of counted) {
    if (met(p)) best = Math.max(best, (run += 1));
    else if (!p.current) run = 0;
  }
  let currentStreak = 0;
  for (let i = counted.length - 1; i >= 0; i -= 1) {
    const p = counted[i];
    if (met(p)) currentStreak += 1;
    else if (!p.current) break;
  }

  const now = all[all.length - 1];
  return {
    adherence: due === 0 ? undefined : Math.round((done / due) * 1000) / 10,
    done,
    due,
    currentStreak,
    bestStreak: best,
    periodDone: now.done,
    periodCapacity: now.capacity,
  };
};
