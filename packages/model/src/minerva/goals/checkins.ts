import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";
import { GoalHealth } from "./goals";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Where a check-in was made. */
export enum GoalCheckinSource {
  /** The goal page, or a goal closed with a final value. */
  Goal = "goal",
  DailyReview = "daily_review",
  WeeklyReview = "weekly_review",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A note of where a goal stands on a day: a value, a confidence, or both. */
export class GoalCheckin {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the check-in",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the goal checked in on",
  })
  goalId: string;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description:
      "The day the check-in is for, as YYYY-MM-DD; today or earlier in the caller's timezone",
  })
  checkinDate: string;

  @ApiProperty({
    type: Number,
    required: false,
    description: "An outcome goal's value that day; required for outcome goals",
  })
  value?: number;

  @ApiProperty({
    enum: () => GoalHealth,
    enumName: "GoalHealth",
    enumSchema: {
      description: "How a goal is doing: on track, at risk or off track",
    },
    required: false,
    description:
      "How the goal felt that day; required unless the check-in only records a closing value",
  })
  confidence?: GoalHealth;

  @ApiProperty({
    type: String,
    required: false,
    description: "A note, at most 2,000 characters",
  })
  note?: string;

  @ApiProperty({
    enum: () => GoalCheckinSource,
    enumName: "GoalCheckinSource",
    required: true,
    default: GoalCheckinSource.Goal,
    description: "Where the check-in was made",
  })
  source: GoalCheckinSource;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the check-in was made",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the check-in was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** What the check-in form starts from: where the goal is and where pace says it should be. */
export class GoalCheckinSuggestion {
  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "Today in the caller's timezone, as YYYY-MM-DD",
  })
  checkinDate: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How far the goal has come, 0 to 100",
  })
  progress: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "An outcome goal's current value",
  })
  currentValue?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Where pace says the goal should be today, 0 to 100",
  })
  expectedProgress?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Where pace says an outcome goal's value should be today",
  })
  expectedValue?: number;

  @ApiProperty({
    enum: () => GoalHealth,
    enumName: "GoalHealth",
    enumSchema: {
      description: "How a goal is doing: on track, at risk or off track",
    },
    required: true,
    description:
      "The confidence pace (or a habit's adherence) suggests, ignoring earlier check-ins",
  })
  confidence: GoalHealth;
}

/** A check-in as supplied; the date defaults to today and the source to the goal page. */
export class BaseGoalCheckin extends PartialType(
  PickType(GoalCheckin, [
    "checkinDate",
    "value",
    "confidence",
    "note",
    "source",
  ] as const),
) {}

/** The changes to a check-in. Null removes the value or note. */
export class PartialGoalCheckin extends PartialType(
  PickType(GoalCheckin, [
    "checkinDate",
    "value",
    "confidence",
    "note",
  ] as const),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateGoalCheckinRequest {
  @ApiProperty({
    type: () => BaseGoalCheckin,
    required: true,
    description:
      "The check-in. An outcome goal's needs a value; every other needs a confidence.",
  })
  goalCheckin: BaseGoalCheckin;
}

export class UpdateGoalCheckinRequest {
  @ApiProperty({
    type: () => PartialGoalCheckin,
    required: true,
    description: "The changes to the check-in.",
  })
  goalCheckin: PartialGoalCheckin;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListGoalCheckinsResponse {
  @ApiProperty({
    type: () => GoalCheckin,
    isArray: true,
    required: true,
    description: "The goal's check-ins, latest first.",
  })
  goalCheckins: GoalCheckin[];
}

export class CreateGoalCheckinResponse {
  @ApiProperty({
    type: () => GoalCheckin,
    required: true,
    description: "The check-in as made.",
  })
  goalCheckin: GoalCheckin;
}

export class UpdateGoalCheckinResponse {
  @ApiProperty({
    type: () => GoalCheckin,
    required: true,
    description: "The check-in with the changes applied.",
  })
  goalCheckin: GoalCheckin;
}

export class SuggestGoalCheckinResponse {
  @ApiProperty({
    type: () => GoalCheckinSuggestion,
    required: true,
    description: "The check-in form's defaults for today.",
  })
  suggestion: GoalCheckinSuggestion;
}
