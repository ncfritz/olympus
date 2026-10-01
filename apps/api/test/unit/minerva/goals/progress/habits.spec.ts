import { HabitFrequency } from "@ncfritz/olympus-model";
import { describe, expect, it } from "vitest";
import {
  type EngineHabitLog,
  habitSummary,
  isMet,
} from "../../../../../src/minerva/goals/progress";

const done = (...dates: string[]): EngineHabitLog[] =>
  dates.map((date) => ({ date, done: true }));

/** Thursday Oct 1 2026 is today throughout. */
const TODAY = "2026-10-01";

describe("habitSummary", () => {
  describe("daily", () => {
    const rule = { frequency: HabitFrequency.Daily, timesPerPeriod: 1 };

    it("does not count today against the habit until it is over", () => {
      const s = habitSummary(
        rule,
        done("2026-09-28", "2026-09-29", "2026-09-30"),
        "2026-09-28",
        TODAY,
      );
      expect(s).toMatchObject({ done: 3, due: 3, adherence: 100 });
      expect(s.currentStreak).toBe(3);
      expect(s.periodDone).toBe(0);
      expect(s.periodCapacity).toBe(1);
    });

    it("counts today once it is done", () => {
      const s = habitSummary(
        rule,
        done("2026-09-29", TODAY),
        "2026-09-28",
        TODAY,
      );
      // Sep 28 and 30 missed, Sep 29 and today done.
      expect(s).toMatchObject({ done: 2, due: 4, adherence: 50 });
      expect(s.currentStreak).toBe(1);
      expect(s.bestStreak).toBe(1);
    });

    it("looks back 28 days", () => {
      const s = habitSummary(rule, [], "2026-01-01", TODAY);
      expect(s.due).toBe(27);
      expect(s.adherence).toBe(0);
    });

    it("has nothing due on its first day until it is done", () => {
      const s = habitSummary(rule, [], TODAY, TODAY);
      expect(s.adherence).toBeUndefined();
      expect(s.due).toBe(0);
    });

    it("has nothing due before it starts", () => {
      expect(habitSummary(rule, [], "2026-10-05", TODAY)).toMatchObject({
        due: 0,
        currentStreak: 0,
      });
    });

    it("ignores logs before the start or after today", () => {
      const s = habitSummary(
        rule,
        done("2026-09-27", "2026-10-02"),
        "2026-09-30",
        TODAY,
      );
      expect(s).toMatchObject({ done: 0, due: 1 });
    });

    it("finds the best streak in the whole history", () => {
      const s = habitSummary(
        rule,
        done(
          "2026-09-01",
          "2026-09-02",
          "2026-09-03",
          "2026-09-04",
          "2026-09-05",
          "2026-09-29",
          "2026-09-30",
        ),
        "2026-09-01",
        TODAY,
      );
      expect(s.bestStreak).toBe(5);
      expect(s.currentStreak).toBe(2);
    });
  });

  describe("weekdays", () => {
    // Monday, Wednesday and Friday.
    const rule = {
      frequency: HabitFrequency.Weekdays,
      timesPerPeriod: 1,
      weekdays: [1, 3, 5],
    };

    it("only holds the chosen days to it; days off do not break a streak", () => {
      const s = habitSummary(
        rule,
        done(
          "2026-09-21",
          "2026-09-23",
          "2026-09-25",
          "2026-09-28",
          "2026-09-30",
        ),
        "2026-09-21",
        TODAY,
      );
      expect(s).toMatchObject({ done: 5, due: 5, adherence: 100 });
      expect(s.currentStreak).toBe(5);
      // Thursday is not a chosen day.
      expect(s.periodCapacity).toBe(0);
    });
  });

  describe("weekly", () => {
    const rule = { frequency: HabitFrequency.Weekly, timesPerPeriod: 3 };

    it("holds whole weeks to the count and the current week only to what is done", () => {
      // Week 38 (Sep 14) three runs, week 39 two, week 40 (this week) one so far.
      const s = habitSummary(
        rule,
        done(
          "2026-09-14",
          "2026-09-16",
          "2026-09-18",
          "2026-09-22",
          "2026-09-24",
          "2026-09-29",
        ),
        "2026-09-14",
        TODAY,
      );
      expect(s).toMatchObject({ done: 6, due: 7, adherence: 85.7 });
      expect(s.periodDone).toBe(1);
      expect(s.periodCapacity).toBe(3);
      // Week 39 fell short; week 40 is not over.
      expect(s.currentStreak).toBe(0);
      expect(s.bestStreak).toBe(1);
    });

    it("caps a week's count at the times it asks for", () => {
      const s = habitSummary(
        rule,
        done(
          "2026-09-21",
          "2026-09-22",
          "2026-09-23",
          "2026-09-24",
          "2026-09-25",
        ),
        "2026-09-21",
        TODAY,
      );
      expect(s).toMatchObject({ done: 3, due: 3 });
    });

    it("asks no more of a first week than the days left in it", () => {
      // Started on Saturday Sep 26: two days of week 39.
      const s = habitSummary(rule, done("2026-09-27"), "2026-09-26", TODAY);
      expect(s).toMatchObject({ done: 1, due: 2, adherence: 50 });
    });

    it("looks back four weeks, this one included", () => {
      const s = habitSummary(rule, [], "2026-08-03", TODAY);
      expect(s.due).toBe(9);
    });
  });

  describe("monthly", () => {
    const rule = { frequency: HabitFrequency.Monthly, timesPerPeriod: 2 };

    it("looks back three months, this one included", () => {
      const s = habitSummary(
        rule,
        done("2026-08-03", "2026-08-20", "2026-09-10", TODAY),
        "2026-01-01",
        TODAY,
      );
      // August 2 of 2, September 1 of 2, October 1 so far.
      expect(s).toMatchObject({ done: 4, due: 5, adherence: 80 });
    });
  });

  describe("by quantity", () => {
    const rule = {
      frequency: HabitFrequency.Daily,
      timesPerPeriod: 1,
      quantityTarget: 8000,
    };

    it("counts a day when the quantity reaches the target", () => {
      expect(isMet({ date: TODAY, done: false, quantity: 8000 }, rule)).toBe(
        true,
      );
      expect(isMet({ date: TODAY, done: false, quantity: 7999 }, rule)).toBe(
        false,
      );
      expect(isMet({ date: TODAY, done: true }, rule)).toBe(true);
      const s = habitSummary(
        rule,
        [
          { date: "2026-09-29", done: false, quantity: 9100 },
          { date: "2026-09-30", done: false, quantity: 4200 },
        ],
        "2026-09-29",
        TODAY,
      );
      expect(s).toMatchObject({ done: 1, due: 2, adherence: 50 });
    });
  });
});
