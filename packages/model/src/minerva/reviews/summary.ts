import { ApiProperty } from "@nestjs/swagger";
import { ReviewKind } from "./reviews";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Where a day or week stands in its reviews. */
export enum ReviewPeriodStatus {
  /** Reviewed, and the review completed. */
  Complete = "complete",
  /** Reviewed, the review not yet completed. */
  Draft = "draft",
  /** Past, with no review. */
  Missed = "missed",
  /** The current period, not reviewed yet. */
  Open = "open",
  /** After the current period. */
  Upcoming = "upcoming",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A review's ratings, or averages of them; each 1 to 5, absent when unrated. */
export class ReviewRatings {
  @ApiProperty({
    type: Number,
    required: false,
    description: "Overall, on both kinds",
  })
  overall?: number;

  @ApiProperty({ type: Number, required: false, description: "A day's mood" })
  mood?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "A day's energy",
  })
  energy?: number;

  @ApiProperty({ type: Number, required: false, description: "A day's focus" })
  focus?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "A week's progress",
  })
  progress?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "A week's balance",
  })
  balance?: number;
}

/** One day or week of a summary. */
export class ReviewPeriodSummary {
  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "The day, or the week's Monday, as YYYY-MM-DD",
  })
  periodStart: string;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "The day itself, or the week's Sunday, as YYYY-MM-DD",
  })
  periodEnd: string;

  @ApiProperty({
    enum: () => ReviewPeriodStatus,
    enumName: "ReviewPeriodStatus",
    required: true,
    description:
      "complete, draft, missed (past, no review), open (the current period, not reviewed yet) or upcoming",
  })
  status: ReviewPeriodStatus;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether this is the period today falls in, where the caller is",
  })
  current: boolean;

  @ApiProperty({
    type: String,
    required: false,
    description: "The period's review, when there is one",
  })
  reviewId?: string;

  @ApiProperty({
    type: () => ReviewRatings,
    required: true,
    description: "The review's ratings; empty with no review",
  })
  ratings: ReviewRatings;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The first line of the review's first answered Reflect prompt, at most 140 characters",
  })
  headline?: string;
}

/**
 * The reviews of a range of days or weeks, computed on read (ADR 0027):
 * each period's status, ratings and headline, the averages of the completed
 * reviews against the range before, the counts and the streaks.
 */
export class ReviewSummary {
  @ApiProperty({
    enum: () => ReviewKind,
    enumName: "ReviewKind",
    enumSchema: {
      description: "Whether a review is of a day or of an ISO week",
    },
    required: true,
    description: "Whether the summary is of days or of weeks",
  })
  kind: ReviewKind;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "Today where the caller is, as YYYY-MM-DD",
  })
  today: string;

  @ApiProperty({
    type: () => ReviewPeriodSummary,
    isArray: true,
    required: true,
    description: "Every day or week in the range, oldest first",
  })
  periods: ReviewPeriodSummary[];

  @ApiProperty({
    type: () => ReviewRatings,
    required: true,
    description:
      "Each rating's average over the range's completed reviews, to two decimals",
  })
  averages: ReviewRatings;

  @ApiProperty({
    type: () => ReviewRatings,
    required: true,
    description:
      "The same averages over as many periods just before the range, for comparison",
  })
  previousAverages: ReviewRatings;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Periods in the range with a completed review",
  })
  complete: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Periods in the range whose review is a draft",
  })
  drafts: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Periods in the range that have begun: everything but the upcoming ones",
  })
  due: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Completed periods in a row up to now: from the current period when it is complete, otherwise from the one before",
  })
  currentStreak: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The longest run of completed periods within the range",
  })
  bestStreak: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class GetReviewSummaryResponse {
  @ApiProperty({
    type: () => ReviewSummary,
    required: true,
    description: "The summary of the range.",
  })
  summary: ReviewSummary;
}
