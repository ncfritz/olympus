import { GoalStatus, GoalType } from "@ncfritz/olympus-model";
import { addDays, type IsoDate } from "../../utils/localDates";
import { periods } from "./habits";
import { percent } from "./measures";
import type { EngineGoal } from "./types";

/** Done over due, with the score when anything was due. */
export type ExecutionCount = { done: number; due: number; score?: number };

export type Execution = ExecutionCount & {
  from: IsoDate;
  to: IsoDate;
  goals: (ExecutionCount & { goalId: string })[];
  days: (ExecutionCount & { date: IsoDate })[];
};

/** Statuses whose habits are planned work: active, or closed (counted up to the close). */
const COUNTED = [
  GoalStatus.Active,
  GoalStatus.Achieved,
  GoalStatus.Missed,
  GoalStatus.Dropped,
];

const count = (done: number, due: number): ExecutionCount =>
  due === 0 ? { done, due } : { done, due, score: percent((done / due) * 100) };

/**
 * Planned goal work done over due from `from` to `to` (ADR 0026): habit
 * occurrences, for now; goal-linked tasks join when Tasks exists.
 *
 * - Each habit period (a day, an ISO week, a month) counts on the day it
 *   ends, when that day falls in the span: a week counts on its Sunday, a
 *   month on its last day.
 * - Nothing after today is due. The period running today, or running when
 *   the goal closed or fell due, is due only as much as it is done, so it
 *   is never held against the habit early.
 * - Draft, paused and deleted goals are not counted; a closed goal counts
 *   up to the day it closed.
 */
export const computeExecution = (
  goals: EngineGoal[],
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
): Execution => {
  const last = to < today ? to : today;
  const days = new Map<IsoDate, { done: number; due: number }>();
  for (let d = from; d <= last; d = addDays(d, 1)) {
    days.set(d, { done: 0, due: 0 });
  }

  const perGoal: Execution["goals"] = [];
  for (const goal of goals) {
    if (
      goal.deleted ||
      goal.type !== GoalType.Habit ||
      !goal.habitRule ||
      !COUNTED.includes(goal.status)
    ) {
      continue;
    }
    let cutoff = today;
    if (goal.dueDate !== undefined && goal.dueDate < cutoff) {
      cutoff = goal.dueDate;
    }
    if (goal.closedOn !== undefined && goal.closedOn < cutoff) {
      cutoff = goal.closedOn;
    }
    if (cutoff < goal.startDate || cutoff < from) continue;

    let done = 0;
    let due = 0;
    for (const p of periods(
      goal.habitRule,
      goal.habitLogs,
      goal.startDate,
      cutoff,
    )) {
      // Still running: today's period, or the one the goal stopped in.
      const running = p.end > cutoff || (p.current && cutoff === today);
      const day = days.get(running ? cutoff : p.end);
      if (!day) continue;
      const pDue = running ? p.done : p.capacity;
      day.done += p.done;
      day.due += pDue;
      done += p.done;
      due += pDue;
    }
    if (done > 0 || due > 0)
      perGoal.push({ goalId: goal.id, ...count(done, due) });
  }

  const total = perGoal.reduce(
    (sum, g) => ({ done: sum.done + g.done, due: sum.due + g.due }),
    { done: 0, due: 0 },
  );
  return {
    from,
    to,
    ...count(total.done, total.due),
    goals: perGoal,
    days: [...days.entries()].map(([date, c]) => ({
      date,
      ...count(c.done, c.due),
    })),
  };
};
