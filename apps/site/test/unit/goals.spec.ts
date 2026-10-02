import type {
  FullGoal,
  Goal,
  GoalCycle,
  GoalHabitLog,
} from "@ncfritz/olympus-sdk/minerva";
import { describe, expect, it } from "vitest";
import {
  cycleBands,
  dueText,
  emptyGoalForm,
  formatDay,
  formatValue,
  formToCreate,
  formToUpdate,
  goalToForm,
  goalTree,
  habitGrid,
  healthCounts,
  inHorizon,
  metricText,
  outcomeNumbers,
  outcomeSeries,
  quarterBands,
  rankForFocus,
  roadmapMark,
} from "../../src/utils/goals";

const TODAY = "2026-10-01";

const goal = (id: string, overrides: Partial<Goal> = {}): Goal => ({
  id,
  categoryId: "health",
  title: id,
  type: "milestone",
  status: "active",
  horizon: "year",
  startDate: "2026-01-01",
  dueDate: "2026-12-31",
  progressMode: "milestones",
  weight: 1,
  position: 0,
  tolerancePct: 10,
  tagIds: [],
  subGoalIds: [],
  progress: 0,
  needsDecision: false,
  deleted: false,
  createdTime: "2026-01-01T00:00:00Z",
  ...overrides,
});

const books = goal("books", {
  type: "outcome",
  progressMode: "checkins",
  unit: "books",
  startValue: 0,
  targetValue: 24,
  currentValue: 17,
  progress: 70.8,
  expectedProgress: 75,
  health: "on_track",
});

describe("goal words", () => {
  it("writes numbers as people do", () => {
    expect(formatValue(17)).toBe("17");
    expect(formatValue(186.44)).toBe("186.4");
    expect(formatValue(1250)).toBe("1,250");
    expect(formatValue(undefined)).toBe("–");
  });

  it("writes days short, with the year only when it is not this one", () => {
    expect(formatDay("2026-12-31", TODAY)).toBe("Dec 31");
    expect(formatDay("2027-03-01", TODAY)).toBe("Mar 1, 2027");
  });

  it.each([
    [books, "17 of 24 books"],
    [
      goal("w", {
        ...books,
        unit: undefined,
        currentValue: undefined,
        startValue: 186.4,
        targetValue: 180,
      }),
      "186.4 of 180",
    ],
    [goal("m", { progress: 33.3 }), "33.3% of milestones"],
    [
      goal("h", { type: "habit", progressMode: "habit", progress: 85.7 }),
      "85.7% adherence",
    ],
    [
      goal("s", { progressMode: "subgoals", subGoalIds: ["a", "b"] }),
      "Rolled up from 2 sub-goals",
    ],
    [
      goal("s1", { progressMode: "subgoals", subGoalIds: ["a"] }),
      "Rolled up from 1 sub-goal",
    ],
    [goal("man", { progressMode: "manual", progress: 40 }), "40% done"],
    [
      goal("a", { type: "achievement", progressMode: "status" }),
      "Not achieved yet",
    ],
    [
      goal("won", {
        type: "achievement",
        progressMode: "status",
        status: "achieved",
      }),
      "Achieved",
    ],
  ])("puts %s's metric in words", (g, words) => {
    expect(metricText(g)).toBe(words);
  });

  it("says when a goal is due, or that it is ongoing", () => {
    expect(dueText(books, TODAY)).toBe("Dec 31");
    expect(dueText(goal("run", { dueDate: undefined }), TODAY)).toBe("Ongoing");
  });
});

describe("rankForFocus", () => {
  it("puts goals needing a decision first, then by health, then the soonest due", () => {
    const ranked = rankForFocus([
      goal("calm", { health: "on_track", position: 0 }),
      goal("late", { health: "at_risk", dueDate: "2026-12-18", position: 1 }),
      goal("soon", { health: "at_risk", dueDate: "2026-10-31", position: 2 }),
      goal("habit", { health: "at_risk", dueDate: undefined, position: 3 }),
      goal("bad", { health: "off_track", position: 4 }),
      goal("stuck", { health: "at_risk", needsDecision: true, position: 5 }),
      goal("draft", { status: "draft", health: undefined, position: 6 }),
    ]);
    expect(ranked.map((g) => g.id)).toEqual([
      "stuck",
      "bad",
      "soon",
      "late",
      "habit",
      "calm",
      "draft",
    ]);
  });
});

describe("goalTree", () => {
  const tree = [
    goal("year"),
    goal("cycle", { parentId: "year" }),
    goal("ship", { parentId: "cycle" }),
    goal("step", { parentId: "ship" }),
    goal("detail", { parentId: "step" }),
    goal("loose", { parentId: "elsewhere" }),
  ];

  it("indents sub-goals under their parents, three levels deep", () => {
    expect(
      goalTree(tree).map((r) => [r.goal.id, r.depth, r.hiddenBelow]),
    ).toEqual([
      ["year", 0, 0],
      ["cycle", 1, 0],
      ["ship", 2, 2],
      ["loose", 0, 0],
    ]);
  });

  it("shows a level more under a goal that is expanded", () => {
    expect(
      goalTree(tree, 3, new Set(["ship"])).map((r) => [
        r.goal.id,
        r.depth,
        r.hiddenBelow,
      ]),
    ).toEqual([
      ["year", 0, 0],
      ["cycle", 1, 0],
      ["ship", 2, 0],
      ["step", 3, 1],
      ["loose", 0, 0],
    ]);
  });
});

describe("filters and counts", () => {
  it("counts active goals by health", () => {
    expect(
      healthCounts([
        books,
        goal("a", { health: "at_risk" }),
        goal("o", { health: "off_track" }),
        goal("p", { status: "paused" }),
      ]),
    ).toEqual({ active: 3, on_track: 1, at_risk: 1, off_track: 1 });
  });

  const cycle = { id: "c4" } as GoalCycle;

  it.each([
    [
      "all",
      goal("x", { startDate: "2025-01-01", dueDate: "2025-12-31" }),
      true,
    ],
    [
      "year",
      goal("x", { startDate: "2025-01-01", dueDate: "2025-12-31" }),
      false,
    ],
    ["year", books, true],
    [
      "quarter",
      goal("x", { startDate: "2026-01-01", dueDate: "2026-06-30" }),
      false,
    ],
    [
      "quarter",
      goal("x", { startDate: "2026-11-01", dueDate: "2026-11-30" }),
      true,
    ],
    ["quarter", goal("x", { dueDate: undefined }), true],
    ["cycle", goal("x", { cycleId: "c4" }), true],
    ["cycle", books, false],
    ["ongoing", goal("x", { horizon: "ongoing", dueDate: undefined }), true],
  ] as const)("horizon %s takes %s: %s", (choice, g, taken) => {
    expect(inHorizon(g, choice, TODAY, cycle)).toBe(taken);
  });
});

describe("the roadmap", () => {
  it("bands the quarters across the year", () => {
    const bands = quarterBands(2026);
    expect(bands.map((b) => b.label)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(bands[0].from).toBe(0);
    expect(bands[1].from).toBeCloseTo(90 / 365);
    expect(bands[3].to).toBe(1);
  });

  it("bands a cycle with its buffer week", () => {
    const [band] = cycleBands(
      [
        {
          name: "Cycle 4",
          startDate: "2026-09-07",
          endDate: "2026-11-29",
          bufferEndDate: "2026-12-06",
        } as GoalCycle,
        {
          name: "Old",
          startDate: "2025-01-06",
          endDate: "2025-03-30",
          bufferEndDate: "2025-04-06",
        } as GoalCycle,
      ],
      2026,
    );
    expect(band.label).toBe("Cycle 4");
    expect(band.from).toBeCloseTo(249 / 365);
    expect(band.to).toBeCloseTo(333 / 365);
    expect(band.buffer).toBeCloseTo(340 / 365);
  });

  it("marks goals as bars, ongoing lines and diamonds", () => {
    expect(roadmapMark(books, 2026)).toEqual({
      kind: "bar",
      from: 0,
      to: 1,
      filled: 0.708,
    });
    expect(
      roadmapMark(
        goal("run", { startDate: "2026-03-02", dueDate: undefined }),
        2026,
      ),
    ).toEqual({ kind: "ongoing", from: 60 / 365 });
    expect(
      roadmapMark(
        goal("exam", {
          type: "achievement",
          progressMode: "status",
          dueDate: "2026-12-12",
        }),
        2026,
      )?.kind,
    ).toBe("diamond");
    expect(
      roadmapMark(
        goal("old", { dueDate: "2025-06-30", startDate: "2025-01-01" }),
        2026,
      ),
    ).toBeUndefined();
  });
});

describe("an outcome's numbers", () => {
  it("works out pace, projection and the rate needed", () => {
    // 273 days in, 91 left: 17 books so far.
    const n = outcomeNumbers(books, TODAY);
    expect(n.current).toBe(17);
    expect(n.expected).toBe(18);
    expect(n.projected).toBeCloseTo((17 / 273) * 364);
    expect(n.neededPerWeek).toBeCloseTo((7 / 91) * 7);
  });

  it("draws check-ins from the start value, the pace line and its band", () => {
    const s = outcomeSeries(
      books,
      [
        {
          id: "2",
          goalId: "books",
          checkinDate: "2026-09-30",
          value: 17,
          source: "goal",
          createdTime: "",
        },
        {
          id: "1",
          goalId: "books",
          checkinDate: "2026-06-01",
          value: 9,
          source: "goal",
          createdTime: "",
        },
        {
          id: "c",
          goalId: "books",
          checkinDate: "2026-09-20",
          confidence: "at_risk",
          source: "goal",
          createdTime: "",
        },
      ],
      TODAY,
    );
    expect(s.checkins.map(([, v]) => v)).toEqual([0, 9, 17]);
    expect(s.pace.map(([, v]) => v)).toEqual([0, 24]);
    expect(s.band[0][1]).toBeCloseTo(-2.4);
    expect(s.band[0][2]).toBeCloseTo(2.4);
    expect(s.projection).toHaveLength(2);
  });
});

describe("habitGrid", () => {
  const log = (logDate: string, met = true) =>
    ({ logDate, met, done: met }) as GoalHabitLog;

  it("lays twelve weeks out Monday first, oldest left, counting days met", () => {
    const grid = habitGrid(
      [log("2026-09-28"), log("2026-09-30"), log("2026-09-29", false)],
      { frequency: "daily" },
      "2026-07-01",
      TODAY,
    );
    expect(grid).toHaveLength(12);
    expect(grid[0].weekOf).toBe("2026-07-13");
    const now = grid[11];
    expect(now.weekOf).toBe("2026-09-28");
    expect(now.days).toEqual([
      "done",
      "partial",
      "done",
      "future",
      "future",
      "future",
      "future",
    ]);
    expect(now.met).toBe(2);
    expect(grid[0].days[1]).toBe("missed");
  });

  it("marks days before the start, and a weekdays habit's days off", () => {
    const grid = habitGrid(
      [],
      { frequency: "weekdays", weekdays: [1, 3, 5] },
      "2026-09-23",
      TODAY,
      2,
    );
    expect(grid[0].days).toEqual([
      "before",
      "before",
      "missed",
      "off",
      "missed",
      "off",
      "off",
    ]);
  });

  it("does not hold a weekly habit's empty days against it", () => {
    const grid = habitGrid([], { frequency: "weekly" }, "2026-01-01", TODAY, 1);
    expect(grid[0].days.slice(0, 3)).toEqual(["off", "off", "off"]);
  });
});

describe("the goal form", () => {
  it("creates a cycle goal with milestones and tags, leaving its dates to the cycle", () => {
    expect(
      formToCreate({
        ...emptyGoalForm("work"),
        type: "milestone",
        title: " Ship Minerva Goals v1 ",
        why: "  ",
        horizon: "cycle",
        cycleId: "c4",
        progressMode: "milestones",
        milestones: [
          { title: "Data model" },
          { title: " " },
          { title: "UI", dueDate: "2026-10-16" },
        ],
        tagIds: ["olympus"],
        startValue: 3,
      }),
    ).toEqual({
      goal: {
        categoryId: "work",
        cycleId: "c4",
        title: "Ship Minerva Goals v1",
        type: "milestone",
        status: "active",
        horizon: "cycle",
        progressMode: "milestones",
      },
      milestones: [
        { title: "Data model" },
        { title: "UI", dueDate: "2026-10-16" },
      ],
      tagIds: ["olympus"],
    });
  });

  it("creates a habit with its rule, only the fields its frequency uses", () => {
    const request = formToCreate({
      ...emptyGoalForm("health"),
      type: "habit",
      title: "Run",
      horizon: "ongoing",
      startDate: "2026-10-01",
      dueDate: "2026-12-31",
      progressMode: "habit",
      frequency: "weekly",
      timesPerPeriod: 3,
      weekdays: [1],
      quantityUnit: "km",
    });
    expect(request.goal).not.toHaveProperty("dueDate");
    expect(request.habitRule).toEqual({
      frequency: "weekly",
      timesPerPeriod: 3,
    });
  });

  const full = {
    ...books,
    why: "Ideas",
    habitRule: undefined,
    milestones: [],
    subGoals: [],
    tags: [{ id: "t1", name: "reading", goalCount: 1, createdTime: "" }],
  } as FullGoal;

  it("round-trips a goal, so an untouched form changes nothing", () => {
    const form = goalToForm(full);
    expect(formToUpdate(form, form)).toEqual({});
  });

  it("sends only what changed, a cleared field as null, and tags when they change", () => {
    const before = goalToForm(full);
    expect(
      formToUpdate(before, {
        ...before,
        title: "Read 30 books",
        targetValue: 30,
        why: "",
        tagIds: ["t1", "t2"],
      }),
    ).toEqual({
      goal: { title: "Read 30 books", targetValue: 30, why: null },
      tagIds: ["t1", "t2"],
    });
  });
});
