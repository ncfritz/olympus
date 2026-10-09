import { ReviewItemScope, ReviewKind } from "@ncfritz/olympus-model";
import { describe, expect, it } from "vitest";
import {
  currentPeriodStart,
  itemPeriodEndOf,
  nextPeriodStart,
  periodEndOf,
  periodStartOf,
  SCOPE_OF,
  STEPS,
  takesRating,
} from "../../../../../src/minerva/reviews/utils/periods";

describe("periodStartOf", () => {
  it("takes a day as YYYY-MM-DD for a daily review", () => {
    expect(periodStartOf(ReviewKind.Daily, "2026-10-01")).toBe("2026-10-01");
  });

  it.each([["2026-W40"], ["2026-02-30"], ["10/01/2026"], [20261001], [null]])(
    "refuses %j for a daily review",
    (period) => {
      expect(periodStartOf(ReviewKind.Daily, period)).toBeUndefined();
    },
  );

  it("takes an ISO week, or its Monday, for a weekly review", () => {
    expect(periodStartOf(ReviewKind.Weekly, "2026-W40")).toBe("2026-09-28");
    expect(periodStartOf(ReviewKind.Weekly, "2026-09-28")).toBe("2026-09-28");
    expect(periodStartOf(ReviewKind.Weekly, "2026-W53")).toBe("2026-12-28");
    expect(periodStartOf(ReviewKind.Weekly, "2027-W01")).toBe("2027-01-04");
  });

  it.each([["2026-09-29"], ["2027-W53"], ["2026-W00"], ["2026-10"]])(
    "refuses %j for a weekly review",
    (period) => {
      expect(periodStartOf(ReviewKind.Weekly, period)).toBeUndefined();
    },
  );
});

describe("periodEndOf", () => {
  it("is the day itself, or the week's Sunday", () => {
    expect(periodEndOf(ReviewKind.Daily, "2026-10-01")).toBe("2026-10-01");
    expect(periodEndOf(ReviewKind.Weekly, "2026-09-28")).toBe("2026-10-04");
    expect(periodEndOf(ReviewKind.Weekly, "2026-12-28")).toBe("2027-01-03");
  });
});

describe("currentPeriodStart", () => {
  it("is today, or this week's Monday", () => {
    expect(currentPeriodStart(ReviewKind.Daily, "2026-10-01")).toBe(
      "2026-10-01",
    );
    expect(currentPeriodStart(ReviewKind.Weekly, "2026-10-01")).toBe(
      "2026-09-28",
    );
    expect(currentPeriodStart(ReviewKind.Weekly, "2026-09-28")).toBe(
      "2026-09-28",
    );
    expect(currentPeriodStart(ReviewKind.Weekly, "2026-10-04")).toBe(
      "2026-09-28",
    );
  });
});

describe("ratings and steps", () => {
  it("gives each kind its own ratings, overall on both", () => {
    expect(takesRating(ReviewKind.Daily, "overall")).toBe(true);
    expect(takesRating(ReviewKind.Daily, "focus")).toBe(true);
    expect(takesRating(ReviewKind.Daily, "progress")).toBe(false);
    expect(takesRating(ReviewKind.Weekly, "overall")).toBe(true);
    expect(takesRating(ReviewKind.Weekly, "balance")).toBe(true);
    expect(takesRating(ReviewKind.Weekly, "mood")).toBe(false);
  });

  it("has four daily steps and five weekly ones", () => {
    expect(STEPS).toEqual({ daily: 4, weekly: 5 });
  });
});

describe("nextPeriodStart", () => {
  it("plans the next day or the next week after a daily review", () => {
    expect(
      nextPeriodStart(ReviewKind.Daily, "2026-10-01", ReviewItemScope.Day),
    ).toBe("2026-10-02");
    expect(
      nextPeriodStart(ReviewKind.Daily, "2026-10-01", ReviewItemScope.Week),
    ).toBe("2026-10-05");
    expect(
      nextPeriodStart(ReviewKind.Daily, "2026-10-04", ReviewItemScope.Week),
    ).toBe("2026-10-05");
  });

  it("plans the next Monday or the next week after a weekly review", () => {
    expect(
      nextPeriodStart(ReviewKind.Weekly, "2026-09-28", ReviewItemScope.Day),
    ).toBe("2026-10-05");
    expect(
      nextPeriodStart(ReviewKind.Weekly, "2026-09-28", ReviewItemScope.Week),
    ).toBe("2026-10-05");
    expect(
      nextPeriodStart(ReviewKind.Weekly, "2026-12-28", ReviewItemScope.Week),
    ).toBe("2027-01-04");
  });
});

describe("itemPeriodEndOf and SCOPE_OF", () => {
  it("ends a day item on its day and a week item on its Sunday", () => {
    expect(itemPeriodEndOf(ReviewItemScope.Day, "2026-10-02")).toBe(
      "2026-10-02",
    );
    expect(itemPeriodEndOf(ReviewItemScope.Week, "2026-10-05")).toBe(
      "2026-10-11",
    );
  });

  it("plans day items from a daily review and week items from a weekly one", () => {
    expect(SCOPE_OF).toEqual({ daily: "day", weekly: "week" });
  });
});
