import {
  GoalHealth,
  GoalProgressMode,
  GoalRollup,
  GoalStatus,
  GoalType,
} from "@ncfritz/olympus-model";
import type { IsoDate } from "../utils/localDates";
import { habitSummary, periodBounds } from "./habits";
import {
  habitHealth,
  latestCheckin,
  milestoneProgress,
  outcomeProgress,
  pace,
  paceHealth,
  percent,
} from "./measures";
import type { EngineCheckin, EngineGoal, GoalProgress } from "./types";

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
    if (goal.status === GoalStatus.Active) {
      result.needsDecision = needsDecision(goal.checkins);
    }

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
      ? habitSummary(
          goal.habitRule,
          goal.habitLogs,
          goal.startDate,
          today,
          habitStop(goal),
        ).adherence
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
 * An active goal's health (ADR 0026). Its latest check-in's confidence
 * stands until the goal's progress changes after it: a later value, a
 * milestone done on a later day, or, for a habit, a new period starting.
 * Otherwise a habit's adherence, or progress against pace, decides; an
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
  if (checkin?.confidence && checkin.date >= lastChange(goal, today)) {
    return checkin.confidence;
  }
  return suggestedHealth(goal, result, today);
};

/**
 * The confidence a goal's numbers suggest, ignoring check-ins: a habit's
 * adherence, progress against pace, or an achievement's due date.
 */
export const suggestedHealth = (
  goal: EngineGoal,
  result: GoalProgress,
  today: IsoDate,
): GoalHealth => {
  if (goal.type === GoalType.Habit) {
    if (!goal.habitRule) return GoalHealth.OnTrack;
    const summary = habitSummary(
      goal.habitRule,
      goal.habitLogs,
      goal.startDate,
      today,
      habitStop(goal),
    );
    return summary.adherence === undefined
      ? GoalHealth.OnTrack
      : habitHealth(summary.adherence);
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

/** The last day the goal's progress moved by something other than a confidence. */
const lastChange = (goal: EngineGoal, today: IsoDate): IsoDate => {
  let last = "";
  const later = (date: IsoDate | undefined) => {
    if (date !== undefined && date > last) last = date;
  };
  const value = latestCheckin(goal.checkins, (c) => c.value !== undefined);
  later(value?.date);
  for (const m of goal.milestones) if (m.done) later(m.doneOn);
  if (goal.habitRule) {
    later(periodBounds(goal.habitRule.frequency, today).start);
  }
  return last;
};

/** The last day a habit ran: the earlier of its closing and due dates. */
export const habitStop = (goal: EngineGoal): IsoDate | undefined =>
  [goal.closedOn, goal.dueDate]
    .filter((d): d is IsoDate => d !== undefined)
    .sort()[0];

/** Whether the last three confidences given were all at risk or off track. */
export const needsDecision = (checkins: EngineCheckin[]): boolean => {
  const recent = checkins
    .filter((c) => c.confidence !== undefined)
    .sort((a, b) =>
      a.date === b.date
        ? b.createdTime.localeCompare(a.createdTime)
        : b.date.localeCompare(a.date),
    )
    .slice(0, 3);
  return (
    recent.length === 3 &&
    recent.every((c) => c.confidence !== GoalHealth.OnTrack)
  );
};

const finish = (
  goals: EngineGoal[],
  compute: (goal: EngineGoal) => GoalProgress,
  results: Map<string, GoalProgress>,
): Map<string, GoalProgress> => {
  for (const goal of goals) compute(goal);
  return results;
};
