import {
  ApiProperty,
  IntersectionType,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";
import { Tag } from "../tags";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** What a goal measures (ADR 0026). */
export enum GoalType {
  /** A number from a start value to a target. */
  Outcome = "outcome",
  /** An ordered checklist. */
  Milestone = "milestone",
  /** Occurrences on a schedule. */
  Habit = "habit",
  /** Done or not. */
  Achievement = "achievement",
}

/** Where a goal is in its life. */
export enum GoalStatus {
  Draft = "draft",
  Active = "active",
  Paused = "paused",
  Achieved = "achieved",
  /** The due date passed short of the target. */
  Missed = "missed",
  /** Stopped by choice. */
  Dropped = "dropped",
}

/** The span a goal is set over; a label, the dates are the goal's own. */
export enum GoalHorizon {
  Year = "year",
  Quarter = "quarter",
  Cycle = "cycle",
  Custom = "custom",
  Ongoing = "ongoing",
}

/** Where a goal's progress comes from; each type allows some of these. */
export enum GoalProgressMode {
  /** An outcome goal's latest check-in value. */
  Checkins = "checkins",
  /** A milestone goal's weighted share of milestones done. */
  Milestones = "milestones",
  /** A habit goal's adherence to its rule. */
  Habit = "habit",
  /** An achievement goal: 100 when achieved, otherwise 0. */
  Status = "status",
  /** Rolled up from the goal's sub-goals. */
  Subgoals = "subgoals",
  /** A milestone goal's progress, set by hand. */
  Manual = "manual",
}

/** How sub-goals combine into their parent's progress. */
export enum GoalRollup {
  Average = "average",
  Weighted = "weighted",
  /** Sub-goals' current values added up; outcome goals sharing a unit. */
  Sum = "sum",
}

/** How a goal is doing: its latest check-in, or what pace suggests. */
export enum GoalHealth {
  OnTrack = "on_track",
  AtRisk = "at_risk",
  OffTrack = "off_track",
}

/** How often a habit is due. */
export enum HabitFrequency {
  Daily = "daily",
  /** A number of times in each ISO week. */
  Weekly = "weekly",
  /** On chosen days of the week. */
  Weekdays = "weekdays",
  /** A number of times in each calendar month. */
  Monthly = "monthly",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A habit goal's schedule. */
export class GoalHabitRule {
  @ApiProperty({
    enum: () => HabitFrequency,
    enumName: "HabitFrequency",
    required: true,
    description: "How often the habit is due",
  })
  frequency: HabitFrequency;

  @ApiProperty({
    type: Number,
    required: true,
    default: 1,
    description:
      "How many times in each period: 1 for daily and weekdays, up to 7 a week or 31 a month",
  })
  timesPerPeriod: number;

  @ApiProperty({
    type: Number,
    isArray: true,
    required: false,
    description:
      "For weekdays: the ISO days it is due, 1 (Monday) to 7 (Sunday)",
  })
  weekdays?: number[];

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "For a habit counted by quantity: the amount a day must reach to count",
  })
  quantityTarget?: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "The quantity's unit, e.g. min or steps",
  })
  quantityUnit?: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the rule was first saved",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the rule was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** A step of a milestone goal. */
export class GoalMilestone {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the milestone",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the goal the milestone belongs to",
  })
  goalId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "What the milestone is, 1 to 120 characters",
  })
  title: string;

  @ApiProperty({
    type: String,
    format: "date",
    required: false,
    description: "When the milestone is due, as YYYY-MM-DD",
  })
  dueDate?: string;

  @ApiProperty({
    type: Number,
    required: true,
    default: 1,
    description:
      "The milestone's share of the goal against the others' weights, above 0",
  })
  weight: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Where the milestone sits in the goal's list; lower comes first",
  })
  position: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the milestone is done",
  })
  done: boolean;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the milestone was done",
  })
  doneTime?: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the milestone was added",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the milestone was last changed",
  })
  lastUpdatedTime?: Moment;
}

/**
 * A goal (ADR 0026), with its progress, pace and health computed for today
 * in the caller's timezone.
 */
export class Goal {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the goal",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the category the goal sits in",
  })
  categoryId: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The ID of the goal this one is a sub-goal of",
  })
  parentId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The ID of the 12-week cycle the goal is set for",
  })
  cycleId?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "What the goal is, 1 to 120 characters",
  })
  title: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Why the goal matters, at most 500 characters",
  })
  why?: string;

  @ApiProperty({
    enum: () => GoalType,
    enumName: "GoalType",
    required: true,
    description: "What the goal measures; fixed once created",
  })
  type: GoalType;

  @ApiProperty({
    enum: () => GoalStatus,
    enumName: "GoalStatus",
    enumSchema: { description: "Where a goal is in its life" },
    required: true,
    description: "Where the goal is in its life",
  })
  status: GoalStatus;

  @ApiProperty({
    enum: () => GoalHorizon,
    enumName: "GoalHorizon",
    required: true,
    description: "The span the goal is set over",
  })
  horizon: GoalHorizon;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "When the goal starts, as YYYY-MM-DD",
  })
  startDate: string;

  @ApiProperty({
    type: String,
    format: "date",
    required: false,
    description: "When the goal is due, as YYYY-MM-DD; absent when ongoing",
  })
  dueDate?: string;

  @ApiProperty({
    enum: () => GoalProgressMode,
    enumName: "GoalProgressMode",
    required: true,
    description:
      "Where the goal's progress comes from: outcome goals check-ins or sub-goals; milestone goals milestones, sub-goals or by hand; habit goals their habit; achievement goals their status",
  })
  progressMode: GoalProgressMode;

  @ApiProperty({
    enum: () => GoalRollup,
    enumName: "GoalRollup",
    required: false,
    description:
      "How sub-goals combine, when progress comes from them; sum is for outcome goals",
  })
  rollup?: GoalRollup;

  @ApiProperty({
    type: Number,
    required: true,
    default: 1,
    description:
      "The goal's weight among its siblings in a weighted rollup, above 0",
  })
  weight: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Progress set by hand, 0 to 100, in manual mode",
  })
  manualProgress?: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Where the goal sits in the user's lists; lower comes first",
  })
  position: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "An outcome goal's unit, e.g. lb or books",
  })
  unit?: string;

  @ApiProperty({
    type: Number,
    required: false,
    description: "An outcome goal's value when it started",
  })
  startValue?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "An outcome goal's target; below the start value for a goal going down",
  })
  targetValue?: number;

  @ApiProperty({
    type: Number,
    required: true,
    default: 10,
    description:
      "How many points of progress behind pace still count as on track, 1 to 50",
  })
  tolerancePct: number;

  @ApiProperty({
    type: String,
    format: "date",
    required: false,
    description: "When the goal was achieved, missed or dropped, as YYYY-MM-DD",
  })
  closedOn?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "What was learned, written when the goal closed",
  })
  closeNote?: string;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "The IDs of the goal's tags",
  })
  tagIds: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "The IDs of the goal's sub-goals that are not deleted",
  })
  subGoalIds: string[];

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
    description:
      "Where pace says the goal should be today, 0 to 100; for active goals with a due date",
  })
  expectedProgress?: number;

  @ApiProperty({
    enum: () => GoalHealth,
    enumName: "GoalHealth",
    enumSchema: {
      description: "How a goal is doing: on track, at risk or off track",
    },
    required: false,
    description: "How an active goal is doing; absent for others",
  })
  health?: GoalHealth;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether an active goal's last three check-ins were all at risk or off track, so it needs a decision",
  })
  needsDecision: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the goal is deleted and can be restored",
  })
  deleted: boolean;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the goal was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the goal was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** A goal with its rule, milestones, sub-goals and tags. */
export class FullGoal extends Goal {
  @ApiProperty({
    type: () => GoalHabitRule,
    required: false,
    description: "A habit goal's schedule",
  })
  habitRule?: GoalHabitRule;

  @ApiProperty({
    type: () => GoalMilestone,
    isArray: true,
    required: true,
    description: "The goal's milestones, in order",
  })
  milestones: GoalMilestone[];

  @ApiProperty({
    type: () => Goal,
    isArray: true,
    required: true,
    description:
      "The goal's sub-goals that are not deleted, one level, in order",
  })
  subGoals: Goal[];

  @ApiProperty({
    type: () => Tag,
    isArray: true,
    required: true,
    description: "The goal's tags, by name",
  })
  tags: Tag[];
}

/** A habit rule as supplied; times per period defaults to 1. */
export class BaseGoalHabitRule extends IntersectionType(
  PickType(GoalHabitRule, ["frequency"] as const),
  PartialType(
    PickType(GoalHabitRule, [
      "timesPerPeriod",
      "weekdays",
      "quantityTarget",
      "quantityUnit",
    ] as const),
  ),
) {}

/** A milestone as supplied; it is added at the end. */
export class BaseGoalMilestone extends IntersectionType(
  PickType(GoalMilestone, ["title"] as const),
  PartialType(PickType(GoalMilestone, ["dueDate", "weight"] as const)),
) {}

/** The changes to a milestone; done ticks or unticks it. */
export class PartialGoalMilestone extends PartialType(
  PickType(GoalMilestone, ["title", "dueDate", "weight", "done"] as const),
) {}

/**
 * A goal as supplied. The progress mode defaults by type; a cycle goal's
 * dates default to its cycle's.
 */
export class BaseGoal extends IntersectionType(
  PickType(Goal, ["categoryId", "title", "type", "horizon"] as const),
  PartialType(
    PickType(Goal, [
      "parentId",
      "cycleId",
      "why",
      "status",
      "startDate",
      "dueDate",
      "progressMode",
      "rollup",
      "weight",
      "manualProgress",
      "unit",
      "startValue",
      "targetValue",
      "tolerancePct",
    ] as const),
  ),
) {}

/** The changes to a goal; its type cannot change. */
export class PartialGoal extends PartialType(
  PickType(Goal, [
    "categoryId",
    "parentId",
    "cycleId",
    "title",
    "why",
    "status",
    "horizon",
    "startDate",
    "dueDate",
    "progressMode",
    "rollup",
    "weight",
    "manualProgress",
    "unit",
    "startValue",
    "targetValue",
    "tolerancePct",
    "closedOn",
    "closeNote",
  ] as const),
) {}

/** How a goal ends: its final status, date, result and lessons. */
export class GoalClose {
  @ApiProperty({
    enum: () => GoalStatus,
    enumName: "GoalStatus",
    enumSchema: { description: "Where a goal is in its life" },
    required: true,
    description: "How the goal ended: achieved, missed or dropped",
  })
  status: GoalStatus;

  @ApiProperty({
    type: String,
    format: "date",
    required: false,
    description:
      "The day the goal closed, as YYYY-MM-DD; defaults to today in the caller's timezone",
  })
  closedOn?: string;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "An outcome goal's final value, recorded as a check-in on the closing day",
  })
  finalValue?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "A goal with progress set by hand: its final progress, 0 to 100",
  })
  finalProgress?: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "What was learned, at most 2,000 characters",
  })
  note?: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateGoalRequest {
  @ApiProperty({
    type: () => BaseGoal,
    required: true,
    description: "The goal to create.",
  })
  goal: BaseGoal;

  @ApiProperty({
    type: () => BaseGoalHabitRule,
    required: false,
    description: "A habit goal's schedule; required for a habit goal.",
  })
  habitRule?: BaseGoalHabitRule;

  @ApiProperty({
    type: () => BaseGoalMilestone,
    isArray: true,
    required: false,
    description: "A milestone goal's milestones, in order.",
  })
  milestones?: BaseGoalMilestone[];

  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "The IDs of the caller's tags to put on the goal.",
  })
  tagIds?: string[];
}

export class UpdateGoalRequest {
  @ApiProperty({
    type: () => PartialGoal,
    required: false,
    description:
      "The changes to the goal. Null clears an optional field. A goal is achieved, missed or dropped with CloseGoal; setting an open status reopens a closed goal and clears its closedOn.",
  })
  goal?: PartialGoal;

  @ApiProperty({
    type: () => BaseGoalHabitRule,
    required: false,
    description: "A habit goal's new schedule, replacing the old.",
  })
  habitRule?: BaseGoalHabitRule;

  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "The goal's tags, replacing the old set.",
  })
  tagIds?: string[];
}

export class CloseGoalRequest {
  @ApiProperty({
    type: () => GoalClose,
    required: true,
    description: "How the goal ends.",
  })
  goalClose: GoalClose;
}

export class ReorderGoalsRequest {
  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "Some of the caller's goals, in the order they should appear: their positions are shared out among them in this order.",
  })
  goalIds: string[];
}

export class CreateGoalMilestoneRequest {
  @ApiProperty({
    type: () => BaseGoalMilestone,
    required: true,
    description: "The milestone to add at the end of the goal's list.",
  })
  goalMilestone: BaseGoalMilestone;
}

export class UpdateGoalMilestoneRequest {
  @ApiProperty({
    type: () => PartialGoalMilestone,
    required: true,
    description: "The changes to the milestone. A due date of null removes it.",
  })
  goalMilestone: PartialGoalMilestone;
}

export class ReorderGoalMilestonesRequest {
  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "Every one of the goal's milestone IDs, in the order they should appear.",
  })
  milestoneIds: string[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListGoalsResponse {
  @ApiProperty({
    type: () => Goal,
    isArray: true,
    required: true,
    description: "The caller's goals that match, in order.",
  })
  goals: Goal[];
}

export class DescribeGoalResponse {
  @ApiProperty({
    type: () => FullGoal,
    required: true,
    description: "The goal, with its rule, milestones, sub-goals and tags.",
  })
  goal: FullGoal;
}

export class CreateGoalResponse {
  @ApiProperty({
    type: () => FullGoal,
    required: true,
    description: "The goal as created.",
  })
  goal: FullGoal;
}

export class UpdateGoalResponse {
  @ApiProperty({
    type: () => FullGoal,
    required: true,
    description: "The goal with the changes applied.",
  })
  goal: FullGoal;
}

export class RestoreGoalResponse {
  @ApiProperty({
    type: () => FullGoal,
    required: true,
    description: "The goal, restored.",
  })
  goal: FullGoal;
}

export class CloseGoalResponse {
  @ApiProperty({
    type: () => FullGoal,
    required: true,
    description: "The goal, closed.",
  })
  goal: FullGoal;
}

export class ReorderGoalsResponse {
  @ApiProperty({
    type: () => Goal,
    isArray: true,
    required: true,
    description: "The goals named, in their new order.",
  })
  goals: Goal[];
}

export class CreateGoalMilestoneResponse {
  @ApiProperty({
    type: () => GoalMilestone,
    required: true,
    description: "The milestone as added.",
  })
  goalMilestone: GoalMilestone;
}

export class UpdateGoalMilestoneResponse {
  @ApiProperty({
    type: () => GoalMilestone,
    required: true,
    description: "The milestone with the changes applied.",
  })
  goalMilestone: GoalMilestone;
}

export class ReorderGoalMilestonesResponse {
  @ApiProperty({
    type: () => GoalMilestone,
    isArray: true,
    required: true,
    description: "The goal's milestones in their new order.",
  })
  goalMilestones: GoalMilestone[];
}
