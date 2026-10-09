import { GoalHealth } from "@ncfritz/olympus-model";
import { describe, expect, it } from "vitest";
import {
  habitHealth,
  latestCheckin,
  milestoneProgress,
  outcomeProgress,
  pace,
  paceHealth,
} from "../../../../../src/minerva/goals/progress";

describe("progress measures", () => {
  describe("outcomeProgress", () => {
    it.each([
      ["half way up", 0, 24, 12, 50],
      ["17 of 24 books", 0, 24, 17, 70.8],
      ["half way down, 190 to 175 lb", 190, 175, 182.5, 50],
      ["down, 186.4 of 180 from 190", 190, 180, 186.4, 36],
      ["the target passed going up", 0, 24, 30, 100],
      ["the target passed going down", 190, 175, 170, 100],
      ["the wrong way going up", 10, 20, 5, 0],
      ["the wrong way going down", 190, 175, 195, 0],
      ["not started", 0, 24, 0, 0],
    ])("%s", (_, start, target, current, expected) => {
      expect(outcomeProgress(start, target, current)).toBe(expected);
    });
  });

  describe("milestoneProgress", () => {
    it("is the weighted share done", () => {
      expect(
        milestoneProgress([
          { weight: 1, done: true },
          { weight: 1, done: true },
          { weight: 1, done: false },
          { weight: 1, done: false },
          { weight: 1, done: false },
          { weight: 1, done: false },
        ]),
      ).toBe(33.3);
      expect(
        milestoneProgress([
          { weight: 3, done: true },
          { weight: 1, done: false },
        ]),
      ).toBe(75);
    });

    it("is 0 with no milestones", () => {
      expect(milestoneProgress([])).toBe(0);
    });
  });

  describe("pace", () => {
    it.each([
      ["on the start day", "2026-01-01", "2026-12-31", "2026-01-01", 0],
      ["on Oct 1, for the year", "2026-01-01", "2026-12-31", "2026-10-01", 75],
      ["on the due day", "2026-01-01", "2026-12-31", "2026-12-31", 100],
      ["after the due day", "2026-01-01", "2026-12-31", "2027-02-01", 100],
      ["before the start", "2026-01-01", "2026-12-31", "2025-12-01", 0],
      [
        "a one-day goal, that day",
        "2026-10-01",
        "2026-10-01",
        "2026-10-01",
        100,
      ],
      [
        "a one-day goal, before it",
        "2026-10-01",
        "2026-10-01",
        "2026-09-30",
        0,
      ],
    ])("%s", (_, start, due, today, expected) => {
      expect(pace(start, due, today)).toBe(expected);
    });
  });

  describe("paceHealth", () => {
    it.each([
      [70.8, 75, 10, GoalHealth.OnTrack],
      [80, 75, 10, GoalHealth.OnTrack],
      [65, 75, 10, GoalHealth.OnTrack],
      [64.9, 75, 10, GoalHealth.AtRisk],
      [55, 75, 10, GoalHealth.AtRisk],
      [54.9, 75, 10, GoalHealth.OffTrack],
      [20, 55, 5, GoalHealth.OffTrack],
    ])("%s against %s with %s tolerance is %s", (p, e, tol, health) => {
      expect(paceHealth(p, e, tol)).toBe(health);
    });
  });

  it("habitHealth", () => {
    expect(habitHealth(94)).toBe(GoalHealth.OnTrack);
    expect(habitHealth(80)).toBe(GoalHealth.OnTrack);
    expect(habitHealth(64)).toBe(GoalHealth.AtRisk);
    expect(habitHealth(59.9)).toBe(GoalHealth.OffTrack);
  });

  it("latestCheckin goes by date, then by when it was written", () => {
    const checkins = [
      { date: "2026-09-20", value: 16, createdTime: "2026-09-20T20:00:00Z" },
      { date: "2026-09-30", value: 17, createdTime: "2026-09-30T08:00:00Z" },
      { date: "2026-09-30", value: 18, createdTime: "2026-09-30T21:00:00Z" },
      // Backfilled later, for an earlier day: not the latest.
      { date: "2026-08-30", value: 15, createdTime: "2026-10-01T09:00:00Z" },
    ];
    expect(latestCheckin(checkins)?.value).toBe(18);
    expect(latestCheckin([])).toBeUndefined();
  });
});
