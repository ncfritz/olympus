import { describe, expect, it } from "vitest";
import {
  GOAL_CATEGORY_ID,
  GOAL_CYCLE_ID,
  GOAL_ID,
  graphQlGoal,
  graphQlTag,
  TAG_ID,
} from "../../../../fixtures/minerva";
import {
  maskToWeekdays,
  toDomainObject,
  toEngineGoal,
  toFullGoal,
  weekdaysToMask,
} from "../../../../../src/minerva/goals/converters/GoalConverter";

const RULE = {
  frequency: "weekdays",
  timesPerPeriod: 1,
  weekdays: 21,
  quantityTarget: "30.5",
  quantityUnit: "min",
  createdTime: "2026-09-14T12:00:00Z",
  lastUpdatedTime: null,
};

describe("GoalConverter", () => {
  describe("weekdays", () => {
    it.each([
      [[1], 1],
      [[7], 64],
      [[1, 3, 5], 21],
      [[1, 2, 3, 4, 5, 6, 7], 127],
    ])("%j is the mask %i and back", (days, mask) => {
      expect(weekdaysToMask(days)).toBe(mask);
      expect(maskToWeekdays(mask)).toEqual(days);
    });

    it("reads a mask in day order whatever order the days came in", () => {
      expect(maskToWeekdays(weekdaysToMask([6, 2]))).toEqual([2, 6]);
    });
  });

  describe("toDomainObject", () => {
    it("maps a row with what the engine worked out", () => {
      const goal = toDomainObject(
        graphQlGoal(),
        { progress: 33.3, expectedProgress: 28.9, health: "on_track" as never },
        ["9b1c0000-0000-4000-8000-0000000000a2"],
      );

      expect(goal).toMatchObject({
        id: GOAL_ID,
        categoryId: GOAL_CATEGORY_ID,
        cycleId: GOAL_CYCLE_ID,
        title: "Ship Minerva Goals v1",
        type: "milestone",
        status: "active",
        horizon: "cycle",
        progressMode: "milestones",
        weight: 1,
        tolerancePct: 10,
        tagIds: [TAG_ID],
        subGoalIds: ["9b1c0000-0000-4000-8000-0000000000a2"],
        progress: 33.3,
        expectedProgress: 28.9,
        health: "on_track",
        deleted: false,
      });
      expect(goal.parentId).toBeUndefined();
      expect(goal.rollup).toBeUndefined();
      expect(goal.currentValue).toBeUndefined();
      expect(goal.lastUpdatedTime).toBeUndefined();
      expect(goal.createdTime.toISOString()).toBe("2026-09-07T12:00:00.000Z");
    });

    it("reads numeric columns sent as strings as numbers", () => {
      const goal = toDomainObject(
        graphQlGoal({
          type: "outcome",
          progressMode: "checkins",
          weight: "2.5",
          startValue: "82.4",
          targetValue: "75",
          unit: "kg",
        }),
        { progress: 0, currentValue: 82.4 },
        [],
      );

      expect(goal).toMatchObject({
        weight: 2.5,
        startValue: 82.4,
        targetValue: 75,
        unit: "kg",
        currentValue: 82.4,
      });
    });

    it("marks a deleted, closed goal", () => {
      const goal = toDomainObject(
        graphQlGoal({
          status: "dropped",
          closedOn: "2026-09-30",
          closeNote: "Not this year",
          deletedTime: "2026-09-30T12:00:00Z",
          lastUpdatedTime: "2026-09-30T12:00:00Z",
        }),
        { progress: 33.3 },
        [],
      );

      expect(goal).toMatchObject({
        deleted: true,
        closedOn: "2026-09-30",
        closeNote: "Not this year",
      });
      expect(goal.lastUpdatedTime?.toISOString()).toBe(
        "2026-09-30T12:00:00.000Z",
      );
    });
  });

  describe("toEngineGoal", () => {
    it("gives the engine the numbers, milestones and rule it reads", () => {
      const engine = toEngineGoal(
        graphQlGoal({
          type: "habit",
          progressMode: "habit",
          habitRule: RULE,
          milestones: graphQlGoal().milestones.slice(0, 3),
          weight: "3",
        }),
      );

      expect(engine).toMatchObject({
        id: GOAL_ID,
        deleted: false,
        weight: 3,
        tolerancePct: 10,
        milestones: [
          { weight: 1, done: true },
          { weight: 1, done: true },
          { weight: 1, done: false },
        ],
        habitRule: {
          frequency: "weekdays",
          timesPerPeriod: 1,
          weekdays: [1, 3, 5],
          quantityTarget: 30.5,
        },
        checkins: [],
        habitLogs: [],
      });
      expect(engine.parentId).toBeUndefined();
    });
  });

  describe("toFullGoal", () => {
    it("adds the rule, milestones, sub-goals and tags by name", () => {
      const row = graphQlGoal({
        habitRule: RULE,
        goalTags: [
          {
            tag: graphQlTag({
              id: "4c8e1f20-0000-4000-8000-000000000002",
              name: "zeta",
            }),
          },
          { tag: graphQlTag() },
        ],
      });
      const goal = toDomainObject(row, { progress: 0 }, []);
      const sub = toDomainObject(
        graphQlGoal({ id: "9b1c0000-0000-4000-8000-0000000000a2" }),
        { progress: 0 },
        [],
      );

      const full = toFullGoal(row, goal, [sub]);

      expect(full.habitRule).toMatchObject({
        weekdays: [1, 3, 5],
        quantityTarget: 30.5,
        quantityUnit: "min",
      });
      expect(full.habitRule?.lastUpdatedTime).toBeUndefined();
      expect(full.milestones).toHaveLength(6);
      expect(full.milestones[0]).toMatchObject({
        title: "Data model and migrations",
        dueDate: "2026-09-18",
        done: true,
        position: 0,
      });
      expect(full.milestones[0].doneTime?.toISOString()).toBe(
        "2026-09-20T20:00:00.000Z",
      );
      expect(full.milestones[2].done).toBe(false);
      expect(full.milestones[2].doneTime).toBeUndefined();
      expect(full.subGoals.map((g) => g.id)).toEqual([
        "9b1c0000-0000-4000-8000-0000000000a2",
      ]);
      expect(full.tags.map((t) => t.name)).toEqual(["olympus", "zeta"]);
    });

    it("leaves out a rule the goal does not have", () => {
      const row = graphQlGoal();
      expect(
        toFullGoal(row, toDomainObject(row, { progress: 0 }, []), []).habitRule,
      ).toBeUndefined();
    });
  });
});
