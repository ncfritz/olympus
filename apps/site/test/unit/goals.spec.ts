import type {
  FullGoal,
  Goal,
  GoalCycle,
  GoalHabitDay,
  GoalHabitLog,
  GoalMilestone,
} from "@ncfritz/olympus-sdk/minerva";
import { describe, expect, it } from "vitest";
import {
  bandSegments,
  cycleSpan,
  cycleSpanText,
  nextCycleDefaults,
  nextMonday,
  cycleBands,
  dueText,
  emptyGoalForm,
  formatDay,
  formatValue,
  formToCreate,
  formToUpdate,
  goalToForm,
  goalTree,
  habitCountPercent,
  habitGrid,
  habitTodayText,
  habitTap,
  healthCounts,
  inHorizon,
  milestoneDueText,
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

  it("keeps a ranked list's order, each sub-goal under its parent", () => {
    const ranked = [
      goal("kid-b", { parentId: "parent" }),
      goal("other"),
      goal("parent"),
      goal("kid-a", { parentId: "parent" }),
      goal("grandkid", { parentId: "kid-a" }),
      goal("orphan", { parentId: "not-in-this-section" }),
    ];
    expect(goalTree(ranked, Infinity).map((r) => [r.goal.id, r.depth])).toEqual(
      [
        ["other", 0],
        ["parent", 0],
        ["kid-b", 1],
        ["kid-a", 1],
        ["grandkid", 2],
        ["orphan", 0],
      ],
    );
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

  it("shows up to twelve weeks ahead, stopping at the due date's week", () => {
    const rule = { frequency: "daily" as const };
    const open = habitGrid([], rule, "2026-07-01", TODAY, 12, 12);
    expect(open).toHaveLength(24);
    expect(open[23].weekOf).toBe("2026-12-21");
    expect(open[23].days.every((c) => c === "future")).toBe(true);

    const due = habitGrid([], rule, "2026-07-01", TODAY, 12, 12, "2026-10-14");
    expect(due).toHaveLength(14);
    expect(due[13].weekOf).toBe("2026-10-12");
    expect(due[13].days).toEqual([
      "future",
      "future",
      "future",
      "after",
      "after",
      "after",
      "after",
    ]);

    const over = habitGrid([], rule, "2026-07-01", TODAY, 12, 12, "2026-09-02");
    expect(over).toHaveLength(12);
    expect(over[7].days.slice(2)).toEqual([
      "missed",
      "after",
      "after",
      "after",
      "after",
    ]);
  });

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

describe("the home widget's words", () => {
  const day = (
    rule: Partial<GoalHabitDay["habitRule"]>,
    extra: Partial<GoalHabitDay> = {},
  ) =>
    ({
      goal: goal("h", { type: "habit", progressMode: "habit" }),
      habitRule: {
        frequency: "daily",
        timesPerPeriod: 1,
        createdTime: "",
        ...rule,
      },
      periodDone: 0,
      periodCapacity: 1,
      ...extra,
    }) as GoalHabitDay;

  it("says what each habit rule asks and how far it has come", () => {
    expect(habitTodayText(day({}))).toBe("Daily · not yet today");
    expect(
      habitTodayText(day({ frequency: "weekdays", weekdays: [1, 3, 5] })),
    ).toBe("Mon, Wed, Fri · not yet today");
    expect(
      habitTodayText(
        day(
          { frequency: "weekly", timesPerPeriod: 3 },
          { periodDone: 2, periodCapacity: 3 },
        ),
      ),
    ).toBe("3× a week · 2 of 3 this week");
    expect(
      habitTodayText(
        day(
          { frequency: "monthly", timesPerPeriod: 8 },
          { periodDone: 1, periodCapacity: 8 },
        ),
      ),
    ).toBe("8× a month · 1 of 8 this month");
  });

  it("gives a counted habit's amount today", () => {
    expect(
      habitTodayText(
        day(
          { quantityTarget: 8, quantityUnit: "glasses" },
          { log: { quantity: 5 } as GoalHabitLog },
        ),
      ),
    ).toBe("5 of 8 glasses today");
    expect(
      habitTodayText(
        day(
          { frequency: "weekly", timesPerPeriod: 3, quantityTarget: 30 },
          { periodDone: 1, periodCapacity: 3 },
        ),
      ),
    ).toBe("0 of 30 today · 1 of 3 this week");
  });

  it("says when a milestone is due, and how late", () => {
    const step = (dueDate?: string) =>
      ({ id: "m", title: "Step", dueDate }) as GoalMilestone;
    expect(milestoneDueText(step(), TODAY)).toEqual({ text: "", late: false });
    expect(milestoneDueText(step("2026-10-01"), TODAY)).toEqual({
      text: "due today",
      late: false,
    });
    expect(milestoneDueText(step("2026-10-09"), TODAY)).toEqual({
      text: "due Oct 9",
      late: false,
    });
    expect(milestoneDueText(step("2026-09-30"), TODAY)).toEqual({
      text: "1 day late",
      late: true,
    });
    expect(milestoneDueText(step("2026-09-28"), TODAY).text).toBe(
      "3 days late",
    );
  });
});

describe("a habit's Done", () => {
  const day = (
    rule: Partial<GoalHabitDay["habitRule"]>,
    log?: Partial<GoalHabitLog>,
  ) =>
    ({
      goal: goal("h", { type: "habit", progressMode: "habit" }),
      habitRule: {
        frequency: "daily",
        timesPerPeriod: 1,
        createdTime: "",
        ...rule,
      },
      log: log as GoalHabitLog | undefined,
      periodDone: 0,
      periodCapacity: 1,
    }) as GoalHabitDay;

  it("marks a yes-or-no habit done, and undoes it once done", () => {
    expect(habitTap(day({}))).toEqual({ action: "log" });
    expect(habitTap(day({}, { met: true, done: true }))).toEqual({
      action: "clear",
    });
  });

  it("counts a habit with a target up by one", () => {
    expect(habitTap(day({ quantityTarget: 8 }))).toEqual({
      action: "log",
      log: { quantity: 1 },
    });
    expect(
      habitTap(day({ quantityTarget: 8 }, { quantity: 8, met: true })),
    ).toEqual({
      action: "log",
      log: { quantity: 9 },
    });
  });

  it("fills a counted habit's line to its share of the target", () => {
    expect(habitCountPercent(day({}))).toBeUndefined();
    expect(habitCountPercent(day({ quantityTarget: 8 }))).toBe(0);
    expect(habitCountPercent(day({ quantityTarget: 8 }, { quantity: 2 }))).toBe(
      25,
    );
    expect(habitCountPercent(day({ quantityTarget: 8 }, { quantity: 9 }))).toBe(
      100,
    );
  });
});

describe("bandSegments", () => {
  it("squares the sides where quarters meet", () => {
    expect(
      bandSegments(quarterBands(2026)).map((s) => [s.roundLeft, s.roundRight]),
    ).toEqual([
      [true, false],
      [false, false],
      [false, false],
      [false, true],
    ]);
  });

  it("squares a cycle where its buffer meets it, and rounds apart cycles", () => {
    const pieces = bandSegments([
      { label: "Cycle 3", from: 0.4, to: 0.6, buffer: 0.62 },
      { label: "Cycle 4", from: 0.7, to: 0.9 },
    ]);
    expect(pieces.map((s) => [s.kind, s.roundLeft, s.roundRight])).toEqual([
      ["band", true, false],
      ["buffer", false, true],
      ["band", true, true],
    ]);
  });
});

describe("cycles", () => {
  const cycle4 = {
    id: "c4",
    name: "Cycle 4",
    startDate: "2026-09-07",
    weeks: 12,
    bufferWeeks: 1,
    endDate: "2026-11-29",
    bufferEndDate: "2026-12-06",
  } as GoalCycle;

  it("works out a cycle's end and buffer", () => {
    expect(cycleSpan("2026-09-07", 12, 1)).toEqual({
      endDate: "2026-11-29",
      bufferEndDate: "2026-12-06",
    });
    expect(cycleSpan("2026-12-07", 6, 0)).toEqual({
      endDate: "2027-01-17",
      bufferEndDate: "2027-01-17",
    });
    expect(cycleSpanText("2026-12-07", 12, 1, TODAY)).toBe(
      "Dec 7 – Feb 28, 2027, buffer to Mar 7, 2027",
    );
  });

  it("finds the next Monday, today when it is one", () => {
    expect(nextMonday("2026-10-01")).toBe("2026-10-05");
    expect(nextMonday("2026-10-05")).toBe("2026-10-05");
    expect(nextMonday("2026-10-04")).toBe("2026-10-05");
  });

  it("plans the next cycle from the latest", () => {
    expect(nextCycleDefaults([cycle4], TODAY)).toEqual({
      name: "Cycle 5",
      startDate: "2026-12-07",
      weeks: 12,
      bufferWeeks: 1,
    });
  });

  it("starts next Monday when the latest cycle is long past", () => {
    const old = { ...cycle4, name: "Spring", bufferEndDate: "2026-06-07" };
    expect(nextCycleDefaults([old], TODAY)).toMatchObject({
      name: "Cycle 2",
      startDate: "2026-10-05",
    });
  });

  it("plans Cycle 1 when there are none", () => {
    expect(nextCycleDefaults([], TODAY)).toEqual({
      name: "Cycle 1",
      startDate: "2026-10-05",
      weeks: 12,
      bufferWeeks: 1,
    });
  });
});
