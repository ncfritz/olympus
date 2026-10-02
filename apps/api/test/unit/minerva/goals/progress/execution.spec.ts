import {
  GoalProgressMode,
  GoalStatus,
  GoalType,
  HabitFrequency,
} from "@ncfritz/olympus-model";
import { describe, expect, it } from "vitest";
import {
  computeExecution,
  type EngineGoal,
  type EngineHabitRule,
} from "../../../../../src/minerva/goals/progress";

/** ISO week 2026-W40: Monday Sep 28 to Sunday Oct 4. Today is Thursday Oct 1. */
const MON = "2026-09-28";
const SUN = "2026-10-04";
const TODAY = "2026-10-01";

const habit = (
  id: string,
  rule: EngineHabitRule,
  logged: string[],
  overrides: Partial<EngineGoal> = {},
): EngineGoal => ({
  id,
  deleted: false,
  type: GoalType.Habit,
  status: GoalStatus.Active,
  progressMode: GoalProgressMode.Habit,
  weight: 1,
  startDate: "2026-09-01",
  tolerancePct: 10,
  milestones: [],
  habitRule: rule,
  checkins: [],
  habitLogs: logged.map((date) => ({ date, done: true })),
  ...overrides,
});

const daily = { frequency: HabitFrequency.Daily, timesPerPeriod: 1 };
const thrice = { frequency: HabitFrequency.Weekly, timesPerPeriod: 3 };
const monWedFri = {
  frequency: HabitFrequency.Weekdays,
  timesPerPeriod: 1,
  weekdays: [1, 3, 5],
};

describe("computeExecution", () => {
  it("counts each day's habits done over due, up to today", () => {
    const result = computeExecution(
      [
        habit("read", daily, ["2026-09-28", "2026-09-29", TODAY]),
        habit("stretch", monWedFri, ["2026-09-28"]),
      ],
      MON,
      SUN,
      TODAY,
    );

    expect(result.days).toEqual([
      { date: "2026-09-28", done: 2, due: 2, score: 100 },
      { date: "2026-09-29", done: 1, due: 1, score: 100 },
      { date: "2026-09-30", done: 0, due: 2, score: 0 },
      { date: TODAY, done: 1, due: 1, score: 100 },
    ]);
    expect(result.goals).toEqual([
      { goalId: "read", done: 3, due: 4, score: 75 },
      { goalId: "stretch", done: 1, due: 2, score: 50 },
    ]);
    expect(result).toMatchObject({
      from: MON,
      to: SUN,
      done: 4,
      due: 6,
      score: 66.7,
    });
  });

  it("does not hold today against a habit before it is over", () => {
    const result = computeExecution(
      [habit("read", daily, ["2026-09-28"])],
      MON,
      SUN,
      TODAY,
    );
    expect(result.days.at(-1)).toEqual({ date: TODAY, done: 0, due: 0 });
  });

  it("counts a running week as far as it is done, on today", () => {
    const result = computeExecution(
      [habit("run", thrice, ["2026-09-28", "2026-09-30"])],
      MON,
      SUN,
      TODAY,
    );
    expect(result.goals).toEqual([
      { goalId: "run", done: 2, due: 2, score: 100 },
    ]);
    expect(result.days.map((d) => d.due)).toEqual([0, 0, 0, 2]);
  });

  it("counts a finished week in full, on its Sunday", () => {
    const result = computeExecution(
      [habit("run", thrice, ["2026-09-22", "2026-09-24"])],
      "2026-09-21",
      "2026-09-27",
      TODAY,
    );
    expect(result.score).toBe(66.7);
    expect(result.days.at(-1)).toEqual({
      date: "2026-09-27",
      done: 2,
      due: 3,
      score: 66.7,
    });
  });

  describe("across a week's end in two timezones", () => {
    // The same runs, asked for W40 on Sunday evening in Seattle, which is
    // already Monday in UTC.
    const goals = [habit("run", thrice, ["2026-09-28", "2026-10-01"])];

    it("in Seattle, Sunday is still today: the week is not over", () => {
      expect(computeExecution(goals, MON, SUN, "2026-10-04")).toMatchObject({
        done: 2,
        due: 2,
        score: 100,
      });
    });

    it("in UTC it is Monday: the week is over, one run short", () => {
      expect(computeExecution(goals, MON, SUN, "2026-10-05")).toMatchObject({
        done: 2,
        due: 3,
        score: 66.7,
      });
    });
  });

  it("counts a month in the week it ends, and not one still running", () => {
    const monthly = { frequency: HabitFrequency.Monthly, timesPerPeriod: 4 };
    const result = computeExecution(
      [habit("call", monthly, ["2026-09-05", "2026-09-19", "2026-10-02"])],
      MON,
      SUN,
      "2026-10-05",
    );
    expect(result.goals).toEqual([
      { goalId: "call", done: 2, due: 4, score: 50 },
    ]);
    expect(result.days.find((d) => d.due > 0)?.date).toBe("2026-09-30");
  });

  it("leaves out days before a habit started", () => {
    const result = computeExecution(
      [habit("read", daily, [], { startDate: "2026-09-30" })],
      MON,
      SUN,
      TODAY,
    );
    expect(result.goals).toEqual([
      { goalId: "read", done: 0, due: 1, score: 0 },
    ]);
  });

  it("counts a closed habit up to the day it closed", () => {
    const result = computeExecution(
      [
        habit("read", daily, ["2026-09-28"], {
          status: GoalStatus.Missed,
          closedOn: "2026-09-29",
        }),
      ],
      MON,
      SUN,
      TODAY,
    );
    expect(result.goals).toEqual([
      { goalId: "read", done: 1, due: 2, score: 50 },
    ]);
  });

  it("stops at a habit's due date", () => {
    const result = computeExecution(
      [habit("read", daily, ["2026-09-28"], { dueDate: "2026-09-29" })],
      MON,
      SUN,
      TODAY,
    );
    expect(result.due).toBe(2);
  });

  it("counts a quantity habit's day only when it reaches the target", () => {
    const rule = { ...daily, quantityTarget: 30 };
    const result = computeExecution(
      [
        habit("read", rule, [], {
          habitLogs: [
            { date: "2026-09-28", done: false, quantity: 30 },
            { date: "2026-09-29", done: false, quantity: 20 },
          ],
        }),
      ],
      MON,
      "2026-09-29",
      TODAY,
    );
    expect(result).toMatchObject({ done: 1, due: 2 });
  });

  it.each([
    ["draft", { status: GoalStatus.Draft }],
    ["paused", { status: GoalStatus.Paused }],
    ["deleted", { deleted: true }],
  ])("leaves out a %s habit", (_, overrides) => {
    const result = computeExecution(
      [habit("read", daily, ["2026-09-28"], overrides)],
      MON,
      SUN,
      TODAY,
    );
    expect(result).toMatchObject({ done: 0, due: 0, goals: [] });
    expect(result.score).toBeUndefined();
  });

  it("leaves out goals that are not habits", () => {
    const result = computeExecution(
      [
        habit("ship", daily, ["2026-09-28"], {
          type: GoalType.Milestone,
          progressMode: GoalProgressMode.Milestones,
        }),
      ],
      MON,
      SUN,
      TODAY,
    );
    expect(result.goals).toEqual([]);
  });

  it("has nothing due in a span still to come", () => {
    const result = computeExecution(
      [habit("read", daily, [])],
      "2026-10-05",
      "2026-10-11",
      TODAY,
    );
    expect(result).toEqual({
      from: "2026-10-05",
      to: "2026-10-11",
      done: 0,
      due: 0,
      goals: [],
      days: [],
    });
  });
});
