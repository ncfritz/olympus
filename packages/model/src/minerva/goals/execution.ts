import { ApiProperty } from "@nestjs/swagger";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Done over due for one goal, or one day. */
export class GoalExecutionCount {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Occurrences done",
  })
  done: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Occurrences due",
  })
  due: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Done over due, 0 to 100; absent when nothing was due",
  })
  score?: number;
}

export class GoalExecutionGoal extends GoalExecutionCount {
  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the habit goal",
  })
  goalId: string;
}

export class GoalExecutionDay extends GoalExecutionCount {
  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description:
      "The day, as YYYY-MM-DD; a week's or month's occurrences count on the day the period ends, or today while it runs",
  })
  date: string;
}

/**
 * Planned goal work done over due across a span of days (ADR 0026):
 * habit occurrences now, goal-linked tasks once Tasks exists. Days after
 * today are not due yet.
 */
export class GoalExecution extends GoalExecutionCount {
  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "The first day of the span, as YYYY-MM-DD",
  })
  from: string;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "The last day of the span, as YYYY-MM-DD",
  })
  to: string;

  @ApiProperty({
    type: () => GoalExecutionGoal,
    isArray: true,
    required: true,
    description: "Each habit goal with something due or done, in goal order",
  })
  goals: GoalExecutionGoal[];

  @ApiProperty({
    type: () => GoalExecutionDay,
    isArray: true,
    required: true,
    description: "Every day of the span up to today, in order",
  })
  days: GoalExecutionDay[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class GetGoalExecutionResponse {
  @ApiProperty({
    type: () => GoalExecution,
    required: true,
    description: "The execution score for the week or cycle asked for.",
  })
  execution: GoalExecution;
}
