import {
  GoalHealth,
  GoalProgressMode,
  GoalRollup,
  GoalStatus,
  GoalType,
  HabitFrequency,
} from "@ncfritz/olympus-model";
import { describe, expect, it } from "vitest";
import {
  computeProgress,
  type EngineGoal,
} from "../../../../../src/minerva/goals/progress";

/** Thursday Oct 1 2026: 273 of the year's 364 days gone, 75 %. */
const TODAY = "2026-10-01";

const goal = (id: string, overrides: Partial<EngineGoal> = {}): EngineGoal => ({
  id,
  deleted: false,
  type: GoalType.Milestone,
  status: GoalStatus.Active,
  progressMode: GoalProgressMode.Milestones,
  weight: 1,
  startDate: "2026-01-01",
  dueDate: "2026-12-31",
  tolerancePct: 10,
  milestones: [],
  checkins: [],
  habitLogs: [],
  ...overrides,
});

const books = (overrides: Partial<EngineGoal> = {}) =>
  goal("books", {
    type: GoalType.Outcome,
    progressMode: GoalProgressMode.Checkins,
    unit: "books",
    startValue: 0,
    targetValue: 24,
    ...overrides,
  });

const milestones = (done: number, total: number) =>
  Array.from({ length: total }, (_, i) => ({ weight: 1, done: i < done }));

describe("computeProgress", () => {
  describe("outcome goals", () => {
    it("measure the latest check-in against pace", () => {
      const result = computeProgress(
        [
          books({
            checkins: [
              {
                date: "2026-09-20",
                value: 16,
                createdTime: "2026-09-20T20:00:00Z",
              },
              {
                date: "2026-09-30",
                value: 17,
                createdTime: "2026-09-30T20:00:00Z",
              },
            ],
          }),
        ],
        TODAY,
      ).get("books");
      expect(result).toEqual({
        progress: 70.8,
        currentValue: 17,
        expectedProgress: 75,
        health: GoalHealth.OnTrack,
      });
    });

    it("start at their start value with no check-ins", () => {
      expect(computeProgress([books()], TODAY).get("books")).toMatchObject({
        progress: 0,
        currentValue: 0,
        health: GoalHealth.OffTrack,
      });
    });

    it("take health from the latest check-in's confidence over pace", () => {
      const result = computeProgress(
        [
          books({
            checkins: [
              {
                date: "2026-09-30",
                value: 4,
                confidence: GoalHealth.OnTrack,
                createdTime: "2026-09-30T20:00:00Z",
              },
            ],
          }),
        ],
        TODAY,
      ).get("books");
      expect(result?.health).toBe(GoalHealth.OnTrack);
    });

    it("work going down", () => {
      const result = computeProgress(
        [
          books({
            id: "weight",
            unit: "lb",
            startValue: 190,
            targetValue: 180,
            startDate: "2026-07-01",
            dueDate: "2026-12-31",
            checkins: [
              {
                date: "2026-09-30",
                value: 186.4,
                createdTime: "2026-09-30T20:00:00Z",
              },
            ],
          }),
        ],
        TODAY,
      ).get("weight");
      expect(result).toMatchObject({ progress: 36, currentValue: 186.4 });
      // 92 of 183 days gone.
      expect(result?.expectedProgress).toBe(50.3);
    });

    it("hold at 100 once the target is passed", () => {
      const result = computeProgress(
        [
          books({
            checkins: [
              {
                date: "2026-09-30",
                value: 30,
                createdTime: "2026-09-30T20:00:00Z",
              },
            ],
          }),
        ],
        TODAY,
      ).get("books");
      expect(result).toMatchObject({ progress: 100, currentValue: 30 });
    });
  });

  describe("milestone goals", () => {
    it("measure milestones done against pace", () => {
      const result = computeProgress(
        [
          goal("ship", {
            startDate: "2026-09-07",
            dueDate: "2026-11-29",
            milestones: milestones(2, 6),
          }),
        ],
        TODAY,
      ).get("ship");
      // 24 of 83 days gone: 28.9 % expected, 33.3 % done.
      expect(result).toEqual({
        progress: 33.3,
        expectedProgress: 28.9,
        health: GoalHealth.OnTrack,
      });
    });

    it("are off track far behind pace", () => {
      const result = computeProgress(
        [goal("ca", { startDate: "2026-06-01", milestones: milestones(1, 5) })],
        TODAY,
      ).get("ca");
      expect(result).toMatchObject({
        progress: 20,
        health: GoalHealth.OffTrack,
      });
    });

    it("set by hand have no pace", () => {
      const result = computeProgress(
        [
          goal("plan", {
            progressMode: GoalProgressMode.Manual,
            manualProgress: 40,
          }),
        ],
        TODAY,
      ).get("plan");
      expect(result).toEqual({ progress: 40, health: GoalHealth.OnTrack });
    });
  });

  describe("habit goals", () => {
    it("measure adherence, with health from it", () => {
      const result = computeProgress(
        [
          goal("run", {
            type: GoalType.Habit,
            progressMode: GoalProgressMode.Habit,
            startDate: "2026-09-14",
            dueDate: undefined,
            habitRule: { frequency: HabitFrequency.Weekly, timesPerPeriod: 3 },
            habitLogs: [
              "2026-09-14",
              "2026-09-16",
              "2026-09-18",
              "2026-09-22",
              "2026-09-24",
              "2026-09-29",
            ].map((date) => ({ date, done: true })),
          }),
        ],
        TODAY,
      ).get("run");
      expect(result).toEqual({ progress: 85.7, health: GoalHealth.OnTrack });
    });

    it("are on track with nothing due yet", () => {
      const result = computeProgress(
        [
          goal("new", {
            type: GoalType.Habit,
            progressMode: GoalProgressMode.Habit,
            startDate: TODAY,
            dueDate: undefined,
            habitRule: { frequency: HabitFrequency.Daily, timesPerPeriod: 1 },
          }),
        ],
        TODAY,
      ).get("new");
      expect(result).toEqual({ progress: 0, health: GoalHealth.OnTrack });
    });
  });

  describe("achievement goals", () => {
    const ham = (overrides: Partial<EngineGoal> = {}) =>
      goal("ham", {
        type: GoalType.Achievement,
        progressMode: GoalProgressMode.Status,
        startDate: "2026-09-01",
        dueDate: "2026-12-12",
        ...overrides,
      });

    it("are 0 until achieved, with no pace", () => {
      expect(computeProgress([ham()], TODAY).get("ham")).toEqual({
        progress: 0,
        health: GoalHealth.OnTrack,
      });
    });

    it("are off track once past due", () => {
      expect(
        computeProgress([ham({ dueDate: "2026-09-30" })], TODAY).get("ham")
          ?.health,
      ).toBe(GoalHealth.OffTrack);
    });

    it("are 100 when achieved, with no health", () => {
      expect(
        computeProgress([ham({ status: GoalStatus.Achieved })], TODAY).get(
          "ham",
        ),
      ).toEqual({ progress: 100 });
    });
  });

  describe("statuses", () => {
    it.each([GoalStatus.Draft, GoalStatus.Paused, GoalStatus.Missed])(
      "%s goals keep their progress but have no pace or health",
      (status) => {
        expect(
          computeProgress(
            [goal("g", { status, milestones: milestones(1, 2) })],
            TODAY,
          ).get("g"),
        ).toEqual({ progress: 50 });
      },
    );

    it("an achieved outcome goal is 100 at its target without a check-in", () => {
      expect(
        computeProgress([books({ status: GoalStatus.Achieved })], TODAY).get(
          "books",
        ),
      ).toEqual({ progress: 100, currentValue: 24 });
    });
  });

  describe("rollups", () => {
    /** Year → cycle goal → two leaves, the shape of G4. */
    const tree = (rollup: GoalRollup) => [
      goal("year", {
        progressMode: GoalProgressMode.Subgoals,
        rollup: GoalRollup.Average,
      }),
      goal("cycle", {
        parentId: "year",
        progressMode: GoalProgressMode.Subgoals,
        rollup,
      }),
      goal("a", { parentId: "cycle", weight: 3, milestones: milestones(1, 1) }),
      goal("b", { parentId: "cycle", weight: 1, milestones: milestones(0, 2) }),
      goal("other", { parentId: "year", milestones: milestones(1, 2) }),
    ];

    it("average sub-goals bottom-up", () => {
      const result = computeProgress(tree(GoalRollup.Average), TODAY);
      expect(result.get("cycle")?.progress).toBe(50);
      expect(result.get("year")?.progress).toBe(50);
    });

    it("weigh sub-goals", () => {
      const result = computeProgress(tree(GoalRollup.Weighted), TODAY);
      expect(result.get("cycle")?.progress).toBe(75);
      expect(result.get("year")?.progress).toBe(62.5);
    });

    it("leave out dropped and deleted sub-goals, and count achieved ones as 100", () => {
      const result = computeProgress(
        [
          goal("p", {
            progressMode: GoalProgressMode.Subgoals,
            rollup: GoalRollup.Average,
          }),
          goal("dropped", {
            parentId: "p",
            status: GoalStatus.Dropped,
            closedOn: undefined,
          } as Partial<EngineGoal>),
          goal("deleted", { parentId: "p", deleted: true }),
          goal("achieved", { parentId: "p", status: GoalStatus.Achieved }),
          goal("half", { parentId: "p", milestones: milestones(1, 2) }),
        ],
        TODAY,
      );
      expect(result.get("p")?.progress).toBe(75);
    });

    it("are 0 with no sub-goals", () => {
      expect(
        computeProgress(
          [
            goal("p", {
              progressMode: GoalProgressMode.Subgoals,
              rollup: GoalRollup.Average,
            }),
          ],
          TODAY,
        ).get("p")?.progress,
      ).toBe(0);
    });

    it("add up outcome sub-goals sharing the parent's unit", () => {
      const result = computeProgress(
        [
          books({
            id: "all",
            progressMode: GoalProgressMode.Subgoals,
            rollup: GoalRollup.Sum,
            targetValue: 24,
          }),
          books({
            id: "fiction",
            parentId: "all",
            targetValue: 12,
            checkins: [
              {
                date: "2026-09-30",
                value: 9,
                createdTime: "2026-09-30T20:00:00Z",
              },
            ],
          }),
          books({
            id: "non-fiction",
            parentId: "all",
            targetValue: 12,
            checkins: [
              {
                date: "2026-09-30",
                value: 8,
                createdTime: "2026-09-30T20:00:00Z",
              },
            ],
          }),
          books({
            id: "pages",
            parentId: "all",
            unit: "pages",
            targetValue: 5000,
          }),
        ],
        TODAY,
      );
      expect(result.get("all")).toMatchObject({
        progress: 70.8,
        currentValue: 17,
      });
    });

    it("put an averaging outcome parent on its own measure", () => {
      const result = computeProgress(
        [
          books({
            id: "parent",
            progressMode: GoalProgressMode.Subgoals,
            rollup: GoalRollup.Average,
            startValue: 190,
            targetValue: 180,
          }),
          goal("leaf", { parentId: "parent", milestones: milestones(1, 2) }),
        ],
        TODAY,
      );
      expect(result.get("parent")).toMatchObject({
        progress: 50,
        currentValue: 185,
      });
    });

    it("do not loop on a goal under its own descendant", () => {
      const result = computeProgress(
        [
          goal("x", {
            parentId: "y",
            progressMode: GoalProgressMode.Subgoals,
            rollup: GoalRollup.Average,
          }),
          goal("y", {
            parentId: "x",
            progressMode: GoalProgressMode.Subgoals,
            rollup: GoalRollup.Average,
          }),
        ],
        TODAY,
      );
      expect(result.get("x")?.progress).toBe(0);
      expect(result.get("y")?.progress).toBe(0);
    });
  });
});
