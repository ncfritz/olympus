import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";
import { ReviewAnswer } from "./answers";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Whether a review, or a prompt, is of a day or of an ISO week. */
export enum ReviewKind {
  Daily = "daily",
  Weekly = "weekly",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * A daily or weekly review (ADR 0027): what its author scored and wrote.
 * What happened in the period is read from the features that own it.
 */
export class Review {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the review",
  })
  id: string;

  @ApiProperty({
    enum: () => ReviewKind,
    enumName: "ReviewKind",
    enumSchema: {
      description: "Whether a review is of a day or of an ISO week",
    },
    required: true,
    description: "Whether the review is of a day or a week",
  })
  kind: ReviewKind;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description:
      "The day reviewed, or the Monday of the ISO week reviewed, as YYYY-MM-DD",
  })
  periodStart: string;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description:
      "The last day the review covers as YYYY-MM-DD: the day itself, or the week's Sunday",
  })
  periodEnd: string;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The guided step the author reached: 1 to 4 for a day, 1 to 5 for a week",
  })
  step: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "How the day or week went overall, 1 (low) to 5 (high)",
  })
  overall?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "A day's mood, 1 (low) to 5 (high); never on a week",
  })
  mood?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "A day's energy, 1 (low) to 5 (high); never on a week",
  })
  energy?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "A day's focus, 1 (scattered) to 5 (locked in); never on a week",
  })
  focus?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "A week's progress, 1 (stalled) to 5 (moved a lot); never on a day",
  })
  progress?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "A week's balance, 1 (work-heavy) to 5 (balanced); never on a day",
  })
  balance?: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the review has been completed; a completed review's ratings no longer change",
  })
  completed: boolean;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the review was completed",
  })
  completedTime?: Moment;

  @ApiProperty({
    type: () => ReviewAnswer,
    isArray: true,
    required: true,
    description: "What the author wrote, one answer per prompt answered",
  })
  answers: ReviewAnswer[];

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the review was started",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the review was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** What is supplied to start a review: its kind and the period reviewed. */
export class BaseReview extends PickType(Review, ["kind"] as const) {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The period reviewed: a day as YYYY-MM-DD; a week as YYYY-Www (2026-W40) or its Monday as YYYY-MM-DD",
  })
  period: string;
}

/** The changes to a review; only what is named is changed. */
export class PartialReview extends PartialType(
  PickType(Review, [
    "step",
    "overall",
    "mood",
    "energy",
    "focus",
    "progress",
    "balance",
  ] as const),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateReviewRequest {
  @ApiProperty({
    type: () => BaseReview,
    required: true,
    description: "The kind of review and the period it is of.",
  })
  review: BaseReview;
}

export class UpdateReviewRequest {
  @ApiProperty({
    type: () => PartialReview,
    required: true,
    description:
      "The step reached and the ratings. A rating of null clears it; ratings are refused once the review is completed, and each kind takes only its own.",
  })
  review: PartialReview;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListReviewsResponse {
  @ApiProperty({
    type: () => Review,
    isArray: true,
    required: true,
    description: "The caller's reviews in the range, oldest first.",
  })
  reviews: Review[];
}

export class DescribeReviewResponse {
  @ApiProperty({
    type: () => Review,
    required: true,
    description: "The review.",
  })
  review: Review;
}

export class CreateReviewResponse {
  @ApiProperty({
    type: () => Review,
    required: true,
    description: "The review as started.",
  })
  review: Review;
}

export class UpdateReviewResponse {
  @ApiProperty({
    type: () => Review,
    required: true,
    description: "The review with the changes applied.",
  })
  review: Review;
}

export class CompleteReviewResponse {
  @ApiProperty({
    type: () => Review,
    required: true,
    description: "The review, completed.",
  })
  review: Review;
}
