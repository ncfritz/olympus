import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";
import { Goal, GoalHabitRule } from "./goals";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A habit goal's record for one of the caller's local days. */
export class GoalHabitLog {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the log",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the habit goal",
  })
  goalId: string;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "The day logged, as YYYY-MM-DD",
  })
  logDate: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the habit was marked done that day",
  })
  done: boolean;

  @ApiProperty({
    type: Number,
    required: false,
    description: "How much was done that day, in the rule's quantity unit",
  })
  quantity?: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "A note, at most 500 characters",
  })
  note?: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the day counts: marked done, or its quantity reached the rule's target",
  })
  met: boolean;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the day was first logged",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the log was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** What a habit's logs come to as of a day, by its current rule. */
export class GoalHabitSummary {
  @ApiProperty({
    type: Number,
    required: false,
    description:
      "Done over due across the last 28 days, 4 weeks or 3 months, 0 to 100; absent when nothing was due yet",
  })
  adherence?: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Occurrences done in that window",
  })
  done: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Occurrences due in that window; the current period is due only as much as it is done",
  })
  due: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Periods met in a row, back from today; a current period not met yet does not break it",
  })
  currentStreak: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The longest run of periods met",
  })
  bestStreak: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Occurrences done so far in the current period",
  })
  periodDone: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Occurrences the current period holds",
  })
  periodCapacity: number;
}

/** A habit on the day's strip: the goal, the day's log and its period so far. */
export class GoalHabitDay {
  @ApiProperty({
    type: () => Goal,
    required: true,
    description: "The habit goal",
  })
  goal: Goal;

  @ApiProperty({
    type: () => GoalHabitRule,
    required: true,
    description:
      "The habit's schedule, and the amount a day must reach to count",
  })
  habitRule: GoalHabitRule;

  @ApiProperty({
    type: () => GoalHabitLog,
    required: false,
    description: "The day's log, if it has one",
  })
  log?: GoalHabitLog;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Occurrences done in the day's period, up to and including it",
  })
  periodDone: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Occurrences the day's period holds",
  })
  periodCapacity: number;
}

/** A day's log as supplied; done defaults to true unless a quantity is given. */
export class BaseGoalHabitLog extends PartialType(
  PickType(GoalHabitLog, ["done", "quantity", "note"] as const),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class LogGoalHabitRequest {
  @ApiProperty({
    type: () => BaseGoalHabitLog,
    required: false,
    description:
      "The day's log, replacing any already there. Omitted, the day is marked done.",
  })
  goalHabitLog?: BaseGoalHabitLog;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class LogGoalHabitResponse {
  @ApiProperty({
    type: () => GoalHabitLog,
    required: true,
    description: "The day's log as saved.",
  })
  goalHabitLog: GoalHabitLog;
}

export class ListGoalHabitLogsResponse {
  @ApiProperty({
    type: () => GoalHabitLog,
    isArray: true,
    required: true,
    description: "The habit's logs in the range asked for, oldest first.",
  })
  goalHabitLogs: GoalHabitLog[];

  @ApiProperty({
    type: () => GoalHabitSummary,
    required: true,
    description: "Adherence and streaks as of today.",
  })
  summary: GoalHabitSummary;
}

export class ListGoalHabitsForDayResponse {
  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "The day listed, as YYYY-MM-DD",
  })
  date: string;

  @ApiProperty({
    type: () => GoalHabitDay,
    isArray: true,
    required: true,
    description: "The active habits due that day, in goal order.",
  })
  habits: GoalHabitDay[];
}
