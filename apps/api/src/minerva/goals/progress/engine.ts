import {
  GoalHealth,
  GoalProgressMode,
  GoalRollup,
  GoalStatus,
  GoalType,
} from "@ncfritz/olympus-model";
import type { IsoDate } from "../utils/localDates";
import { habitSummary } from "./habits";
import {
  habitHealth,
  latestCheckin,
  milestoneProgress,
  outcomeProgress,
  pace,
  paceHealth,
  percent,
} from "./measures";
import type { EngineGoal, GoalProgress } from "./types";

/**
 * Progress, pace and health for every goal given, as of `today` in the
 * caller's timezone (ADR 0026). Rollups walk the tree bottom-up, so the
 * goals passed should be all of a user's, even when only some are shown.
 */
export const computeProgress = (
  goals: EngineGoal[],
  today: IsoDate,
): Map<string, GoalProgress> => {
  const children = new Map<string, EngineGoal[]>();
  for (const goal of goals) {
    if (goal.deleted || !goal.parentId) continue;
    children.set(goal.parentId, [...(children.get(goal.parentId) ?? []), goal]);
  }

  const results = new Map<string, GoalProgress>();
  const visiting = new Set<string>();

  const compute = (goal: EngineGoal): GoalProgress => {
    const known = results.get(goal.id);
    if (known) return known;
    // The API refuses a goal under its own descendant; should one exist
    // anyway, it counts as no progress rather than looping.
    if (visiting.has(goal.id)) return { progress: 0 };
    visiting.add(goal.id);

    const result = progressOf(goal, children.get(goal.id) ?? [], compute);
    const expected = expectedOf(goal);
    if (expected !== undefined) result.expectedProgress = expected;
    const health = healthOf(goal, result, today);
    if (health !== undefined) result.health = health;

    visiting.delete(goal.id);
    results.set(goal.id, result);
    return result;
  };

  const expectedOf = (goal: EngineGoal): number | undefined =>
    goal.status === GoalStatus.Active &&
    goal.dueDate !== undefined &&
    (goal.type === GoalType.Outcome || goal.type === GoalType.Milestone) &&
    goal.progressMode !== GoalProgressMode.Manual
      ? pace(goal.startDate, goal.dueDate, today)
      : undefined;

  const habitAdherence = (goal: EngineGoal): number | undefined =>
    goal.habitRule
      ? habitSummary(goal.habitRule, goal.habitLogs, goal.startDate, today)
          .adherence
      : undefined;

  const progressOf = (
    goal: EngineGoal,
    kids: EngineGoal[],
    of: (goal: EngineGoal) => GoalProgress,
  ): GoalProgress => {
    const outcome =
      goal.startValue !== undefined && goal.targetValue !== undefined
        ? { start: goal.startValue, target: goal.targetValue }
        : undefined;

    if (goal.status === GoalStatus.Achieved) {
      return {
        progress: 100,
        currentValue: outcome
          ? (latestCheckin(goal.checkins, (c) => c.value !== undefined)
              ?.value ?? outcome.target)
          : undefined,
      };
    }

    switch (goal.progressMode) {
      case GoalProgressMode.Checkins: {
        if (!outcome) return { progress: 0 };
        const currentValue =
          latestCheckin(goal.checkins, (c) => c.value !== undefined)?.value ??
          outcome.start;
        return {
          progress: outcomeProgress(
            outcome.start,
            outcome.target,
            currentValue,
          ),
          currentValue,
        };
      }
      case GoalProgressMode.Milestones:
        return { progress: milestoneProgress(goal.milestones) };
      case GoalProgressMode.Habit:
        return { progress: habitAdherence(goal) ?? 0 };
      case GoalProgressMode.Manual:
        return { progress: percent(goal.manualProgress ?? 0) };
      case GoalProgressMode.Status:
        return { progress: 0 };
      case GoalProgressMode.Subgoals:
        return rollup(goal, kids, of, outcome);
    }
  };

  return finish(goals, compute, results);
};

/**
 * A parent's progress from its sub-goals. Dropped sub-goals are left out;
 * an achieved one counts as 100. Average and weighted combine the
 * sub-goals' progress; sum adds the current values of outcome sub-goals
 * that share the parent's unit and measures that total against the
 * parent's own start and target.
 */
const rollup = (
  goal: EngineGoal,
  kids: EngineGoal[],
  of: (goal: EngineGoal) => GoalProgress,
  outcome: { start: number; target: number } | undefined,
): GoalProgress => {
  const counted = kids.filter((k) => k.status !== GoalStatus.Dropped);

  if (goal.rollup === GoalRollup.Sum) {
    if (!outcome) return { progress: 0 };
    const total = counted
      .filter((k) => k.type === GoalType.Outcome && k.unit === goal.unit)
      .reduce((sum, k) => sum + (of(k).currentValue ?? 0), 0);
    const currentValue = outcome.start + total;
    return {
      progress: outcomeProgress(outcome.start, outcome.target, currentValue),
      currentValue,
    };
  }

  let progress = 0;
  if (counted.length > 0) {
    const weighted = goal.rollup === GoalRollup.Weighted;
    const total = counted.reduce((s, k) => s + (weighted ? k.weight : 1), 0);
    progress = percent(
      counted.reduce(
        (s, k) => s + of(k).progress * (weighted ? k.weight : 1),
        0,
      ) / total,
    );
  }
  return {
    progress,
    // An outcome parent averaging its sub-goals shows where that progress
    // puts it on its own measure.
    currentValue: outcome
      ? outcome.start + (progress / 100) * (outcome.target - outcome.start)
      : undefined,
  };
};

/**
 * An active goal's health: its latest check-in's confidence when it has
 * one; otherwise a habit's adherence, or progress against pace; an
 * achievement past its due date is off track. Other statuses have none.
 */
const healthOf = (
  goal: EngineGoal,
  result: GoalProgress,
  today: IsoDate,
): GoalHealth | undefined => {
  if (goal.status !== GoalStatus.Active) return undefined;
  const checkin = latestCheckin(
    goal.checkins,
    (c) => c.confidence !== undefined,
  );
  if (checkin?.confidence) return checkin.confidence;
  if (goal.type === GoalType.Habit) {
    return goal.habitRule
      ? (() => {
          const summary = habitSummary(
            goal.habitRule,
            goal.habitLogs,
            goal.startDate,
            today,
          );
          return summary.adherence === undefined
            ? GoalHealth.OnTrack
            : habitHealth(summary.adherence);
        })()
      : GoalHealth.OnTrack;
  }
  if (result.expectedProgress !== undefined) {
    return paceHealth(
      result.progress,
      result.expectedProgress,
      goal.tolerancePct,
    );
  }
  if (goal.dueDate !== undefined && today > goal.dueDate) {
    return GoalHealth.OffTrack;
  }
  return GoalHealth.OnTrack;
};

const finish = (
  goals: EngineGoal[],
  compute: (goal: EngineGoal) => GoalProgress,
  results: Map<string, GoalProgress>,
): Map<string, GoalProgress> => {
  for (const goal of goals) compute(goal);
  return results;
};
