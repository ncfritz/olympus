import { describe, expect, it } from "vitest";
import {
  checkGoalValues,
  checkHabitRule,
  checkIdList,
  checkMilestone,
} from "../../../../../src/minerva/goals/utils/goalValues";

const CATEGORY = "6a2d9e40-0000-4000-8000-000000000001";
const CYCLE = "2e7b4c90-0000-4000-8000-000000000001";

const OUTCOME = {
  categoryId: CATEGORY,
  title: "Read 24 books",
  type: "outcome",
  horizon: "year",
  startDate: "2026-01-01",
  dueDate: "2026-12-31",
  unit: "books",
  startValue: 0,
  targetValue: 24,
};

const check = (input: Record<string, unknown>) => {
  const problems: string[] = [];
  const values = checkGoalValues(input, problems);
  return { values, problems };
};

describe("checkGoalValues", () => {
  it("fills the defaults for a new goal", () => {
    const { values, problems } = check(OUTCOME);

    expect(problems).toEqual([]);
    expect(values).toEqual({
      categoryId: CATEGORY,
      parentId: null,
      cycleId: null,
      title: "Read 24 books",
      why: null,
      type: "outcome",
      status: "active",
      horizon: "year",
      startDate: "2026-01-01",
      dueDate: "2026-12-31",
      progressMode: "checkins",
      rollup: null,
      weight: 1,
      manualProgress: null,
      unit: "books",
      startValue: 0,
      targetValue: 24,
      tolerancePct: 10,
      closedOn: null,
      closeNote: null,
    });
  });

  it.each([
    ["outcome", "checkins"],
    ["milestone", "milestones"],
    ["habit", "habit"],
    ["achievement", "status"],
  ])("gives a %s goal the %s mode by default", (type, mode) => {
    const { values } = check({
      ...OUTCOME,
      type,
      unit: undefined,
      startValue: undefined,
      targetValue: undefined,
    });
    expect(values.progressMode).toBe(mode);
  });

  it("accepts each type's other modes, rollups and manual progress", () => {
    expect(
      check({ ...OUTCOME, progressMode: "subgoals", rollup: "sum" }).problems,
    ).toEqual([]);
    const milestone = {
      ...OUTCOME,
      type: "milestone",
      unit: null,
      startValue: null,
      targetValue: null,
    };
    expect(
      check({ ...milestone, progressMode: "subgoals", rollup: "weighted" })
        .problems,
    ).toEqual([]);
    expect(
      check({ ...milestone, progressMode: "manual", manualProgress: 40 })
        .problems,
    ).toEqual([]);
  });

  it("accepts a closed goal with its date, and a cycle goal with its cycle", () => {
    expect(
      check({ ...OUTCOME, status: "missed", closedOn: "2026-12-31" }).problems,
    ).toEqual([]);
    expect(
      check({ ...OUTCOME, horizon: "cycle", cycleId: CYCLE }).problems,
    ).toEqual([]);
    expect(
      check({ ...OUTCOME, horizon: "ongoing", dueDate: null }).problems,
    ).toEqual([]);
  });

  it.each([
    [{ categoryId: undefined }, "categoryId is required"],
    [{ parentId: "goal" }, "parentId must be an ID"],
    [{ title: "" }, "title must be 1 to 120 characters"],
    [{ type: "dream" }, "type must be one of "],
    [{ startDate: "1 Jan" }, "startDate must be a date written YYYY-MM-DD"],
    [{ startDate: undefined }, "startDate is required, written YYYY-MM-DD"],
    [{ weight: 0 }, "weight must be a number above 0 and at most 1000"],
    [{ tolerancePct: 60 }, "tolerancePct must be a whole number from 1 to 50"],
    [{ why: "x".repeat(501) }, "why must be text of at most 500 characters"],
  ])("finds %j wrong on its own", (change, problem) => {
    const { problems } = check({ ...OUTCOME, ...change });
    expect(problems.some((p) => p.startsWith(problem))).toBe(true);
  });

  it("checks the rules between fields only once each field is right", () => {
    const { problems } = check({ ...OUTCOME, title: "", targetValue: 0 });
    expect(problems).toEqual(["title must be 1 to 120 characters"]);
  });

  it.each([
    [
      { progressMode: "habit" },
      "progressMode for a outcome goal must be one of checkins, subgoals",
    ],
    [
      { rollup: "weighted" },
      "rollup is needed exactly when progress comes from sub-goals",
    ],
    [
      { progressMode: "subgoals" },
      "rollup is needed exactly when progress comes from sub-goals",
    ],
    [
      { manualProgress: 50 },
      "manualProgress is needed exactly when progress is set by hand",
    ],
    [
      { startValue: 24 },
      "an outcome goal's targetValue must differ from its startValue",
    ],
    [
      { startValue: null },
      "an outcome goal needs a startValue and a targetValue",
    ],
    [{ dueDate: "2025-12-31" }, "dueDate must not be before startDate"],
    [
      { dueDate: null },
      "an ongoing goal has no dueDate, and every other goal has one",
    ],
    [
      { horizon: "ongoing" },
      "an ongoing goal has no dueDate, and every other goal has one",
    ],
    [
      { cycleId: CYCLE },
      "a cycle goal needs a cycleId, and only a cycle goal has one",
    ],
    [
      { status: "achieved" },
      "closedOn is needed exactly when the goal is achieved, missed or dropped",
    ],
    [
      { closedOn: "2026-10-01" },
      "closedOn is needed exactly when the goal is achieved, missed or dropped",
    ],
  ])("finds %j wrong with the rest", (change, problem) => {
    expect(check({ ...OUTCOME, ...change }).problems).toContain(problem);
  });

  it("keeps a sum rollup and target values to outcome goals", () => {
    const { problems } = check({
      ...OUTCOME,
      type: "milestone",
      progressMode: "subgoals",
      rollup: "sum",
    });
    expect(problems).toEqual([
      "a sum rollup is for outcome goals",
      "only outcome goals have a unit, startValue and targetValue",
    ]);
  });
});

describe("checkHabitRule", () => {
  const rule = (input: unknown) => {
    const problems: string[] = [];
    return { rule: checkHabitRule(input, problems), problems };
  };

  it("defaults to once a period and sorts the weekdays", () => {
    expect(rule({ frequency: "weekdays", weekdays: [5, 1, 3] })).toEqual({
      rule: {
        frequency: "weekdays",
        timesPerPeriod: 1,
        weekdays: [1, 3, 5],
        quantityTarget: null,
        quantityUnit: null,
      },
      problems: [],
    });
  });

  it("takes a quantity with its unit", () => {
    expect(
      rule({
        frequency: "daily",
        quantityTarget: 30,
        quantityUnit: "min",
      }).rule,
    ).toMatchObject({ quantityTarget: 30, quantityUnit: "min" });
  });

  it.each([
    [null, "habitRule must be an object"],
    [{ frequency: "hourly" }, "habitRule.frequency must be one of"],
    [
      { frequency: "weekly", timesPerPeriod: 8 },
      "habitRule.timesPerPeriod must be a whole number from 1 to 7",
    ],
    [
      { frequency: "monthly", timesPerPeriod: 32 },
      "habitRule.timesPerPeriod must be a whole number from 1 to 31",
    ],
    [
      { frequency: "daily", timesPerPeriod: 2 },
      "habitRule.timesPerPeriod must be a whole number from 1 to 1",
    ],
    [
      { frequency: "weekdays", weekdays: [] },
      "habitRule.weekdays must name ISO days 1 to 7, each once",
    ],
    [
      { frequency: "weekdays", weekdays: [1, 1] },
      "habitRule.weekdays must name ISO days 1 to 7, each once",
    ],
    [
      { frequency: "weekdays", weekdays: [0] },
      "habitRule.weekdays must name ISO days 1 to 7, each once",
    ],
    [
      { frequency: "daily", weekdays: [1] },
      "habitRule.weekdays is only for a weekdays habit",
    ],
    [
      { frequency: "daily", quantityTarget: 0 },
      "habitRule.quantityTarget must be a number",
    ],
    [
      { frequency: "daily", quantityUnit: "min" },
      "habitRule.quantityUnit needs a quantityTarget",
    ],
  ])("finds %j wrong", (input, problem) => {
    const { problems } = rule(input);
    expect(problems.some((p) => p.startsWith(problem))).toBe(true);
  });
});

describe("checkMilestone", () => {
  it("trims the title and defaults the weight", () => {
    const problems: string[] = [];
    expect(checkMilestone({ title: "  Beta  " }, "m", problems)).toEqual({
      title: "Beta",
      dueDate: null,
      weight: 1,
    });
    expect(problems).toEqual([]);
  });

  it("names the milestone in each problem", () => {
    const problems: string[] = [];
    checkMilestone(
      { title: "", dueDate: "soon", weight: -1 },
      "milestones[2]",
      problems,
    );
    expect(problems).toEqual([
      "milestones[2].title must be 1 to 120 characters",
      "milestones[2].dueDate must be a date written YYYY-MM-DD",
      "milestones[2].weight must be a number above 0 and at most 1000",
    ]);
  });
});

describe("checkIdList", () => {
  it.each([
    ["not a list", "a", "tagIds must be a list of IDs"],
    ["a non-ID", ["olympus"], "tagIds must be a list of IDs"],
    ["an ID twice", [CATEGORY, CATEGORY], "tagIds must not name an ID twice"],
  ])("rejects %s", (_, value, problem) => {
    const problems: string[] = [];
    checkIdList(value, "tagIds", problems);
    expect(problems).toEqual([problem]);
  });

  it("accepts an empty list", () => {
    const problems: string[] = [];
    expect(checkIdList([], "tagIds", problems)).toEqual([]);
    expect(problems).toEqual([]);
  });
});
