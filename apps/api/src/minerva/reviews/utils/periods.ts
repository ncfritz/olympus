import { ReviewItemScope, ReviewKind } from "@ncfritz/olympus-model";
import {
  addDays,
  type IsoDate,
  isIsoDate,
  isMonday,
  isoWeekBounds,
} from "../../utils/localDates";

/*
 * The periods reviews cover (ADR 0027): a day, or an ISO week from its
 * Monday. Pure functions; the services bring today from the caller's
 * timezone.
 */

/** The ratings each kind of review takes; overall is on both. */
export const RATINGS = {
  [ReviewKind.Daily]: ["overall", "mood", "energy", "focus"],
  [ReviewKind.Weekly]: ["overall", "progress", "balance"],
} as const;

export type RatingName =
  | (typeof RATINGS)[ReviewKind.Daily][number]
  | (typeof RATINGS)[ReviewKind.Weekly][number];

/** Every rating column, either kind's. */
export const ALL_RATINGS: readonly RatingName[] = [
  "overall",
  "mood",
  "energy",
  "focus",
  "progress",
  "balance",
];

/** The guided steps each kind of review has. */
export const STEPS: Record<ReviewKind, number> = {
  [ReviewKind.Daily]: 4,
  [ReviewKind.Weekly]: 5,
};

/** Whether `rating` is one `kind` takes. */
export const takesRating = (kind: ReviewKind, rating: RatingName): boolean =>
  (RATINGS[kind] as readonly RatingName[]).includes(rating);

/**
 * The first day of the period a review names: a day as YYYY-MM-DD; a week
 * as YYYY-Www or its Monday as YYYY-MM-DD. Undefined when the value names
 * no period of that kind.
 */
export const periodStartOf = (
  kind: ReviewKind,
  period: unknown,
): IsoDate | undefined => {
  if (kind === ReviewKind.Daily) {
    return isIsoDate(period) ? period : undefined;
  }
  const week = isoWeekBounds(period);
  if (week) return week.from;
  return isIsoDate(period) && isMonday(period) ? period : undefined;
};

/** The last day a period covers: the day itself, or the week's Sunday. */
export const periodEndOf = (kind: ReviewKind, start: IsoDate): IsoDate =>
  kind === ReviewKind.Daily ? start : addDays(start, 6);

/** The first day of the period `today` falls in. */
export const currentPeriodStart = (
  kind: ReviewKind,
  today: IsoDate,
): IsoDate => {
  if (kind === ReviewKind.Daily) return today;
  const weekday = isoWeekdayOf(today);
  return addDays(today, 1 - weekday);
};

/** 1 for Monday to 7 for Sunday. */
const isoWeekdayOf = (date: IsoDate): number => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};

/** The scope of the items a kind of review plans: a day's, or a week's. */
export const SCOPE_OF: Record<ReviewKind, ReviewItemScope> = {
  [ReviewKind.Daily]: ReviewItemScope.Day,
  [ReviewKind.Weekly]: ReviewItemScope.Week,
};

/** The last day an item's period covers: its day, or its week's Sunday. */
export const itemPeriodEndOf = (scope: ReviewItemScope, start: IsoDate) =>
  scope === ReviewItemScope.Day ? start : addDays(start, 6);

/**
 * The first period of `scope` after a review's: the next day, or the
 * Monday after the review's week. Thursday's daily review plans Friday, or
 * next week; a week's review plans its next Monday, or next week.
 */
export const nextPeriodStart = (
  kind: ReviewKind,
  reviewStart: IsoDate,
  scope: ReviewItemScope,
): IsoDate => {
  const last = periodEndOf(kind, reviewStart);
  return scope === ReviewItemScope.Day
    ? addDays(last, 1)
    : addDays(currentPeriodStart(ReviewKind.Weekly, last), 7);
};
