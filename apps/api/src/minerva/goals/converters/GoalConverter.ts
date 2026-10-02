import {
  FullGoal,
  Goal,
  GoalHabitRule,
  GoalHealth,
  GoalHorizon,
  GoalMilestone,
  GoalProgressMode,
  GoalRollup,
  GoalStatus,
  GoalType,
  HabitFrequency,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  type GraphQlTag,
  toDomainObject as toTag,
} from "../../tags/converters/TagConverter";
import type { EngineGoal, GoalProgress } from "../progress";
import { localDateOf } from "../utils/localDates";

/** Hasura sends `numeric` as a JSON number; a string is read as one too. */
type Numeric = number | string;

export type GraphQlGoalHabitRule = {
  frequency: string;
  timesPerPeriod: number;
  /** The weekday mask: Monday = 1, Tuesday = 2, ... Sunday = 64. */
  weekdays: number | null;
  quantityTarget: Numeric | null;
  quantityUnit: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
};

export type GraphQlGoalMilestone = {
  id: string;
  goalId: string;
  title: string;
  dueDate: string | null;
  weight: Numeric;
  position: number;
  doneTime: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
};

/** A `minerva.goals` row with its rule, milestones and tags. */
export type GraphQlGoal = {
  id: string;
  parentId: string | null;
  categoryId: string;
  cycleId: string | null;
  title: string;
  why: string | null;
  type: string;
  status: string;
  horizon: string;
  startDate: string;
  dueDate: string | null;
  progressMode: string;
  rollup: string | null;
  weight: Numeric;
  manualProgress: number | null;
  position: number;
  unit: string | null;
  startValue: Numeric | null;
  targetValue: Numeric | null;
  tolerancePct: number;
  closedOn: string | null;
  closeNote: string | null;
  deletedTime: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
  habitRule: GraphQlGoalHabitRule | null;
  milestones: GraphQlGoalMilestone[];
  goalTags: { tag: GraphQlTag }[];
  /** Only what progress needs; ListGoalCheckins reads them whole. */
  checkins: {
    checkinDate: string;
    value: Numeric | null;
    confidence: string | null;
    createdTime: string;
  }[];
  habitLogs: { logDate: string; done: boolean; quantity: Numeric | null }[];
};

const num = (value: Numeric): number => Number(value);
const optionalNum = (value: Numeric | null): number | undefined =>
  value === null ? undefined : Number(value);
const optional = <T>(value: T | null): T | undefined => value ?? undefined;
const time = (value: string | null) => (value ? moment(value) : undefined);

/** ISO weekdays (1 = Monday) to the stored mask, and back. */
export const weekdaysToMask = (days: number[]): number =>
  days.reduce((mask, d) => mask | (1 << (d - 1)), 0);

export const maskToWeekdays = (mask: number): number[] =>
  [1, 2, 3, 4, 5, 6, 7].filter((d) => (mask & (1 << (d - 1))) !== 0);

export const toHabitRule = (input: GraphQlGoalHabitRule): GoalHabitRule => ({
  frequency: input.frequency as HabitFrequency,
  timesPerPeriod: input.timesPerPeriod,
  weekdays:
    input.weekdays === null ? undefined : maskToWeekdays(input.weekdays),
  quantityTarget: optionalNum(input.quantityTarget),
  quantityUnit: optional(input.quantityUnit),
  createdTime: moment(input.createdTime),
  lastUpdatedTime: time(input.lastUpdatedTime),
});

export const toMilestone = (input: GraphQlGoalMilestone): GoalMilestone => ({
  id: input.id,
  goalId: input.goalId,
  title: input.title,
  dueDate: optional(input.dueDate),
  weight: num(input.weight),
  position: input.position,
  done: input.doneTime !== null,
  doneTime: time(input.doneTime),
  createdTime: moment(input.createdTime),
  lastUpdatedTime: time(input.lastUpdatedTime),
});

/**
 * What the progress engine reads from a row. Times become the caller's
 * local days, as the engine counts in days.
 */
export const toEngineGoal = (input: GraphQlGoal, tz: string): EngineGoal => ({
  id: input.id,
  parentId: optional(input.parentId),
  deleted: input.deletedTime !== null,
  type: input.type as GoalType,
  status: input.status as GoalStatus,
  progressMode: input.progressMode as GoalProgressMode,
  rollup: optional(input.rollup) as GoalRollup | undefined,
  weight: num(input.weight),
  manualProgress: optional(input.manualProgress),
  startDate: input.startDate,
  dueDate: optional(input.dueDate),
  closedOn: optional(input.closedOn),
  unit: optional(input.unit),
  startValue: optionalNum(input.startValue),
  targetValue: optionalNum(input.targetValue),
  tolerancePct: input.tolerancePct,
  milestones: input.milestones.map((m) => ({
    weight: num(m.weight),
    done: m.doneTime !== null,
    doneOn: m.doneTime === null ? undefined : localDateOf(m.doneTime, tz),
  })),
  habitRule: input.habitRule
    ? {
        frequency: input.habitRule.frequency as HabitFrequency,
        timesPerPeriod: input.habitRule.timesPerPeriod,
        weekdays:
          input.habitRule.weekdays === null
            ? undefined
            : maskToWeekdays(input.habitRule.weekdays),
        quantityTarget: optionalNum(input.habitRule.quantityTarget),
      }
    : undefined,
  checkins: input.checkins.map((c) => ({
    date: c.checkinDate,
    value: optionalNum(c.value),
    confidence: optional(c.confidence) as GoalHealth | undefined,
    createdTime: c.createdTime,
  })),
  habitLogs: input.habitLogs.map((l) => ({
    date: l.logDate,
    done: l.done,
    quantity: optionalNum(l.quantity),
  })),
});

/** The goal as the model has it, with what the engine worked out for it. */
export const toDomainObject = (
  input: GraphQlGoal,
  progress: GoalProgress,
  subGoalIds: string[],
): Goal => ({
  id: input.id,
  categoryId: input.categoryId,
  parentId: optional(input.parentId),
  cycleId: optional(input.cycleId),
  title: input.title,
  why: optional(input.why),
  type: input.type as GoalType,
  status: input.status as GoalStatus,
  horizon: input.horizon as GoalHorizon,
  startDate: input.startDate,
  dueDate: optional(input.dueDate),
  progressMode: input.progressMode as GoalProgressMode,
  rollup: optional(input.rollup) as GoalRollup | undefined,
  weight: num(input.weight),
  manualProgress: optional(input.manualProgress),
  position: input.position,
  unit: optional(input.unit),
  startValue: optionalNum(input.startValue),
  targetValue: optionalNum(input.targetValue),
  tolerancePct: input.tolerancePct,
  closedOn: optional(input.closedOn),
  closeNote: optional(input.closeNote),
  tagIds: input.goalTags.map((t) => t.tag.id),
  subGoalIds,
  progress: progress.progress,
  currentValue: progress.currentValue,
  expectedProgress: progress.expectedProgress,
  health: progress.health,
  needsDecision: progress.needsDecision ?? false,
  deleted: input.deletedTime !== null,
  createdTime: moment(input.createdTime),
  lastUpdatedTime: time(input.lastUpdatedTime),
});

/** The goal with its rule, milestones, sub-goals and tags. */
export const toFullGoal = (
  input: GraphQlGoal,
  goal: Goal,
  subGoals: Goal[],
): FullGoal => ({
  ...goal,
  habitRule: input.habitRule ? toHabitRule(input.habitRule) : undefined,
  milestones: input.milestones.map(toMilestone),
  subGoals,
  tags: input.goalTags
    .map((t) => toTag(t.tag))
    .sort((a, b) => a.name.localeCompare(b.name)),
});
