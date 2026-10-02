import { ApiProperty } from "@nestjs/swagger";
import { Goal, GoalMilestone } from "./goals";
import { GoalHabitDay } from "./habits";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A milestone goal left to act on today, with the step to take next. */
export class GoalNextStep {
  @ApiProperty({
    type: () => Goal,
    required: true,
    description: "The milestone goal",
  })
  goal: Goal;

  @ApiProperty({
    type: () => GoalMilestone,
    required: false,
    description:
      "Its first milestone not yet done; absent when it has none left, or its progress comes from sub-goals or is set by hand",
  })
  milestone?: GoalMilestone;
}

/** How many of the caller's goals of each type are active and started. */
export class GoalTypeCounts {
  @ApiProperty({ type: Number, required: true, description: "Habit goals" })
  habit: number;

  @ApiProperty({ type: Number, required: true, description: "Milestone goals" })
  milestone: number;

  @ApiProperty({ type: Number, required: true, description: "Outcome goals" })
  outcome: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Achievement goals",
  })
  achievement: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Requests and Responses                                                                                             */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListGoalsForTodayResponse {
  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "Today in the caller's timezone, as YYYY-MM-DD",
  })
  date: string;

  @ApiProperty({
    type: () => GoalHabitDay,
    isArray: true,
    required: true,
    description:
      "Habits due today and not yet met today: those due every day or on set weekdays first, then weekly and monthly ones short of their count; each by decision, health, due date and order.",
  })
  habits: GoalHabitDay[];

  @ApiProperty({
    type: () => GoalNextStep,
    isArray: true,
    required: true,
    description:
      "Milestone goals with no milestone done and no check-in today, by decision, health, due date and order.",
  })
  milestones: GoalNextStep[];

  @ApiProperty({
    type: () => Goal,
    isArray: true,
    required: true,
    description:
      "Outcome goals not checked in on today, by decision, health, due date and order.",
  })
  outcomes: Goal[];

  @ApiProperty({
    type: () => Goal,
    isArray: true,
    required: true,
    description:
      "Achievement goals not checked in on today, by decision, health, due date and order.",
  })
  achievements: Goal[];

  @ApiProperty({
    type: () => Goal,
    isArray: true,
    required: true,
    description:
      "Active goals of any type already done for today: a habit met today, a milestone done or a check-in made today; in goal order.",
  })
  done: Goal[];

  @ApiProperty({
    type: () => GoalTypeCounts,
    required: true,
    description: "The active, started goals of each type, done or not.",
  })
  active: GoalTypeCounts;
}
