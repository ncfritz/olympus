import { GoalCycleStatus } from "@ncfritz/olympus-model";
import { describe, expect, it } from "vitest";
import { graphQlGoalCycle } from "../../../../fixtures/minerva";
import {
  cycleEnds,
  toDomainObject,
} from "../../../../../src/minerva/goals/converters/GoalCycleConverter";

describe("GoalCycleConverter", () => {
  it("works out the end of the execution and buffer weeks", () => {
    expect(cycleEnds("2026-09-07", 12, 1)).toEqual({
      endDate: "2026-11-29",
      bufferEndDate: "2026-12-06",
    });
    expect(cycleEnds("2026-09-07", 12, 0)).toEqual({
      endDate: "2026-11-29",
      bufferEndDate: "2026-11-29",
    });
  });

  it.each([
    ["2026-09-06", GoalCycleStatus.Upcoming, undefined],
    ["2026-09-07", GoalCycleStatus.Current, 1],
    ["2026-09-13", GoalCycleStatus.Current, 1],
    ["2026-09-14", GoalCycleStatus.Current, 2],
    ["2026-10-01", GoalCycleStatus.Current, 4],
    ["2026-11-29", GoalCycleStatus.Current, 12],
    ["2026-11-30", GoalCycleStatus.Buffer, 13],
    ["2026-12-06", GoalCycleStatus.Buffer, 13],
    ["2026-12-07", GoalCycleStatus.Past, undefined],
  ])("on %s the cycle is %s, week %s", (today, status, week) => {
    const cycle = toDomainObject(graphQlGoalCycle(), today);
    expect(cycle.status).toBe(status);
    expect(cycle.currentWeek).toBe(week);
  });

  it("maps the row and parses its times", () => {
    const cycle = toDomainObject(graphQlGoalCycle(), "2026-10-01");
    expect(cycle).toMatchObject({
      name: "Cycle 4",
      startDate: "2026-09-07",
      weeks: 12,
      bufferWeeks: 1,
      endDate: "2026-11-29",
      bufferEndDate: "2026-12-06",
    });
    expect(cycle.createdTime.toISOString()).toBe("2026-09-01T12:00:00.000Z");
    expect(cycle.lastUpdatedTime).toBeUndefined();
  });
});
