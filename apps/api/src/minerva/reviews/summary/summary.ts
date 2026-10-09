import {
  ReviewKind,
  ReviewPeriodStatus,
  ReviewPeriodSummary,
  ReviewRatings,
  ReviewSummary,
} from "@ncfritz/olympus-model";
import { addDays, type IsoDate } from "../../utils/localDates";
import {
  currentPeriodStart,
  periodEndOf,
  RATINGS,
  type RatingName,
} from "../utils/periods";

/*
 * A range of reviews summarised (ADR 0027): pure functions over the rows
 * the service reads, with today brought from the caller's timezone. Every
 * rule about statuses, averages, headlines and streaks lives here.
 */

/** The longest headline, in characters, before it is cut with an ellipsis. */
export const HEADLINE_LENGTH = 140;

/** A review as the summary needs it. */
export type SummaryReview = {
  id: string;
  periodStart: IsoDate;
  completed: boolean;
  ratings: Partial<Record<RatingName, number | null>>;
  /** A list prompt's items each, at their positions; a text answer at 0. */
  answers: { promptId: string; body: string; position?: number }[];
};

export type SummaryInput = {
  kind: ReviewKind;
  /** The first and last period starts of the range. */
  from: IsoDate;
  to: IsoDate;
  today: IsoDate;
  /** The reviews of the range and of the range before it. */
  reviews: SummaryReview[];
  /** The kind's Reflect prompts, in their order, archived ones included. */
  reflectPromptIds: string[];
  /** Completed reviews' period starts up to the current period. */
  completedStarts: IsoDate[];
};

/** Days from one period start to the next. */
const stepOf = (kind: ReviewKind) => (kind === ReviewKind.Daily ? 1 : 7);

/** Every period start from `from` to `to`, oldest first. */
export const periodStarts = (
  kind: ReviewKind,
  from: IsoDate,
  to: IsoDate,
): IsoDate[] => {
  const step = stepOf(kind);
  const starts: IsoDate[] = [];
  for (let start = from; start <= to; start = addDays(start, step)) {
    starts.push(start);
  }
  return starts;
};

/** The range of as many periods just before `from`. */
export const previousRange = (
  kind: ReviewKind,
  from: IsoDate,
  to: IsoDate,
): { from: IsoDate; to: IsoDate } => {
  const count = periodStarts(kind, from, to).length;
  const step = stepOf(kind);
  return {
    from: addDays(from, -count * step),
    to: addDays(from, -step),
  };
};

/** Where a period stands, given its review and the current period. */
export const statusOf = (
  review: SummaryReview | undefined,
  start: IsoDate,
  current: IsoDate,
): ReviewPeriodStatus => {
  if (review) {
    return review.completed
      ? ReviewPeriodStatus.Complete
      : ReviewPeriodStatus.Draft;
  }
  if (start < current) return ReviewPeriodStatus.Missed;
  if (start === current) return ReviewPeriodStatus.Open;
  return ReviewPeriodStatus.Upcoming;
};

/**
 * The first line of the first answered Reflect prompt, in the prompts'
 * order, cut to {@link HEADLINE_LENGTH}.
 */
export const headlineOf = (
  review: SummaryReview,
  reflectPromptIds: string[],
): string | undefined => {
  for (const promptId of reflectPromptIds) {
    // A list's first item, by position.
    const answer = review.answers
      .filter((a) => a.promptId === promptId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
    const line = answer?.body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (line) {
      return line.length > HEADLINE_LENGTH
        ? `${line.substring(0, HEADLINE_LENGTH - 1).trimEnd()}…`
        : line;
    }
  }
  return undefined;
};

/** A kind's ratings off a review, unrated ones left out. */
const ratingsOf = (kind: ReviewKind, review?: SummaryReview): ReviewRatings => {
  const ratings: ReviewRatings = {};
  for (const name of RATINGS[kind]) {
    const value = review?.ratings[name];
    if (value !== null && value !== undefined) ratings[name] = value;
  }
  return ratings;
};

/**
 * Each of a kind's ratings averaged over the completed reviews that have
 * it, to two decimals; a rating no completed review has is left out.
 * Drafts are not counted: a review's ratings settle when it is completed.
 */
export const averagesOf = (
  kind: ReviewKind,
  reviews: SummaryReview[],
): ReviewRatings => {
  const averages: ReviewRatings = {};
  for (const name of RATINGS[kind]) {
    const values = reviews
      .filter((r) => r.completed)
      .map((r) => r.ratings[name])
      .filter((v): v is number => typeof v === "number");
    if (values.length) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      averages[name] = Math.round(mean * 100) / 100;
    }
  }
  return averages;
};

/**
 * Completed periods in a row up to now: from the current period when it is
 * complete, otherwise from the one before, so a day not reviewed yet does
 * not break the streak until it is over.
 */
export const currentStreakOf = (
  kind: ReviewKind,
  current: IsoDate,
  completedStarts: IsoDate[],
): number => {
  const done = new Set(completedStarts);
  const step = stepOf(kind);
  let start = done.has(current) ? current : addDays(current, -step);
  let streak = 0;
  while (done.has(start)) {
    streak += 1;
    start = addDays(start, -step);
  }
  return streak;
};

/** The longest run of complete periods among `periods`, in order. */
export const bestStreakOf = (periods: ReviewPeriodSummary[]): number => {
  let best = 0;
  let run = 0;
  for (const period of periods) {
    run = period.status === ReviewPeriodStatus.Complete ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
};

/** The summary of a range of days or weeks. */
export const summarise = (input: SummaryInput): ReviewSummary => {
  const { kind, from, to, today, reviews, reflectPromptIds } = input;
  const current = currentPeriodStart(kind, today);
  const byStart = new Map(reviews.map((r) => [r.periodStart, r]));

  const periods: ReviewPeriodSummary[] = periodStarts(kind, from, to).map(
    (start) => {
      const review = byStart.get(start);
      return {
        periodStart: start,
        periodEnd: periodEndOf(kind, start),
        status: statusOf(review, start, current),
        current: start === current,
        reviewId: review?.id,
        ratings: ratingsOf(kind, review),
        headline: review ? headlineOf(review, reflectPromptIds) : undefined,
      };
    },
  );

  const inRange = (r: SummaryReview) =>
    r.periodStart >= from && r.periodStart <= to;
  const before = previousRange(kind, from, to);
  const inBefore = (r: SummaryReview) =>
    r.periodStart >= before.from && r.periodStart <= before.to;

  const count = (status: ReviewPeriodStatus) =>
    periods.filter((p) => p.status === status).length;

  return {
    kind,
    today,
    periods,
    averages: averagesOf(kind, reviews.filter(inRange)),
    previousAverages: averagesOf(kind, reviews.filter(inBefore)),
    complete: count(ReviewPeriodStatus.Complete),
    drafts: count(ReviewPeriodStatus.Draft),
    due: periods.length - count(ReviewPeriodStatus.Upcoming),
    currentStreak: currentStreakOf(kind, current, input.completedStarts),
    bestStreak: bestStreakOf(periods),
  };
};
