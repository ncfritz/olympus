import { ReviewKind, ReviewPeriodStatus } from "@ncfritz/olympus-model";
import { describe, expect, it } from "vitest";
import {
  averagesOf,
  bestStreakOf,
  currentStreakOf,
  headlineOf,
  HEADLINE_LENGTH,
  periodStarts,
  previousRange,
  statusOf,
  summarise,
  type SummaryReview,
} from "../../../../../src/minerva/reviews/summary/summary";

const WENT_WELL = "8c4f2e00-0000-4000-8000-000000000001";
const DIDNT = "8c4f2e00-0000-4000-8000-000000000002";
const PLAN = "8c4f2e00-0000-4000-8000-000000000005";

/** A daily review: overall, mood, energy, focus; complete unless told. */
const day = (
  periodStart: string,
  [overall, mood, energy, focus]: (number | null)[],
  overrides: Partial<SummaryReview> = {},
): SummaryReview => ({
  id: `review-${periodStart}`,
  periodStart,
  completed: true,
  ratings: { overall, mood, energy, focus, progress: null, balance: null },
  answers: [],
  ...overrides,
});

/** Week 39 as the design canvas draws it: Thursday has no review. */
const WEEK_39 = [
  day("2026-09-21", [4, 4, 4, 4], {
    answers: [{ promptId: WENT_WELL, body: "Weather plan approved." }],
  }),
  day("2026-09-22", [3, 3, 3, 3]),
  day("2026-09-23", [2, 3, 2, 2]),
  day("2026-09-25", [4, 4, 3, 4]),
  day("2026-09-26", [5, 5, 4, 4]),
  day("2026-09-27", [4, 4, 4, 3]),
];

describe("periodStarts and previousRange", () => {
  it("steps by a day or a week", () => {
    expect(periodStarts(ReviewKind.Daily, "2026-09-28", "2026-10-01")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
    expect(periodStarts(ReviewKind.Weekly, "2026-08-31", "2026-09-21")).toEqual(
      ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"],
    );
  });

  it("takes as many periods just before", () => {
    expect(previousRange(ReviewKind.Daily, "2026-09-21", "2026-09-27")).toEqual(
      { from: "2026-09-14", to: "2026-09-20" },
    );
    expect(
      previousRange(ReviewKind.Weekly, "2026-08-31", "2026-09-21"),
    ).toEqual({ from: "2026-08-03", to: "2026-08-24" });
  });
});

describe("statusOf", () => {
  const current = "2026-10-01";
  it.each([
    ["a completed review", day(current, [4, 4, 4, 4]), current, "complete"],
    [
      "a draft",
      day(current, [4, null, null, null], { completed: false }),
      current,
      "draft",
    ],
    ["a past day with no review", undefined, "2026-09-24", "missed"],
    ["today with no review yet", undefined, current, "open"],
    ["tomorrow", undefined, "2026-10-02", "upcoming"],
  ])("is %s's", (_, review, start, status) => {
    expect(statusOf(review, start, current)).toBe(status);
  });
});

describe("headlineOf", () => {
  const order = [WENT_WELL, DIDNT];

  it("takes the first line of the first answered Reflect prompt", () => {
    const review = day("2026-10-01", [4, 4, 3, 2], {
      answers: [
        { promptId: DIDNT, body: "Back-to-back meetings." },
        {
          promptId: WENT_WELL,
          body: "\n  Design review landed.  \nADR merged.",
        },
      ],
    });
    expect(headlineOf(review, order)).toBe("Design review landed.");
  });

  it("falls to the next prompt when the first is unanswered", () => {
    const review = day("2026-10-01", [4, 4, 3, 2], {
      answers: [
        { promptId: PLAN, body: "Protect 9 to 11." },
        { promptId: DIDNT, body: "Back-to-back meetings." },
      ],
    });
    expect(headlineOf(review, order)).toBe("Back-to-back meetings.");
  });

  it("cuts a long line with an ellipsis", () => {
    const review = day("2026-10-01", [4, 4, 3, 2], {
      answers: [{ promptId: WENT_WELL, body: "word ".repeat(60) }],
    });
    const headline = headlineOf(review, order) ?? "";
    expect(headline.length).toBeLessThanOrEqual(HEADLINE_LENGTH);
    expect(headline.endsWith("…")).toBe(true);
  });

  it("is absent with no Reflect answers", () => {
    const review = day("2026-10-01", [4, 4, 3, 2], {
      answers: [{ promptId: PLAN, body: "Protect 9 to 11." }],
    });
    expect(headlineOf(review, order)).toBeUndefined();
  });
});

describe("averagesOf", () => {
  it("averages each rating over completed reviews, to two decimals", () => {
    expect(averagesOf(ReviewKind.Daily, WEEK_39)).toEqual({
      overall: 3.67,
      mood: 3.83,
      energy: 3.33,
      focus: 3.33,
    });
  });

  it("leaves out drafts, unrated values and the other kind's ratings", () => {
    const reviews = [
      day("2026-10-01", [5, null, null, null], { completed: false }),
      day("2026-09-30", [4, null, 3, null]),
      day("2026-09-29", [2, null, null, null]),
    ];
    expect(averagesOf(ReviewKind.Daily, reviews)).toEqual({
      overall: 3,
      energy: 3,
    });
  });

  it("averages a week's three ratings only", () => {
    const week: SummaryReview = {
      id: "w",
      periodStart: "2026-09-28",
      completed: true,
      ratings: { overall: 4, progress: 4, balance: 2, mood: null },
      answers: [],
    };
    expect(averagesOf(ReviewKind.Weekly, [week])).toEqual({
      overall: 4,
      progress: 4,
      balance: 2,
    });
  });
});

describe("streaks", () => {
  const done = [
    "2026-09-30",
    "2026-09-29",
    "2026-09-28",
    "2026-09-27",
    "2026-09-26",
    "2026-09-25",
    "2026-09-23",
  ];

  it("counts back from yesterday while today is not reviewed yet", () => {
    expect(currentStreakOf(ReviewKind.Daily, "2026-10-01", done)).toBe(6);
  });

  it("counts today once it is complete", () => {
    expect(
      currentStreakOf(ReviewKind.Daily, "2026-10-01", ["2026-10-01", ...done]),
    ).toBe(7);
  });

  it("is broken by a missed day", () => {
    expect(currentStreakOf(ReviewKind.Daily, "2026-10-03", done)).toBe(0);
  });

  it("steps by weeks for weekly reviews", () => {
    expect(
      currentStreakOf(ReviewKind.Weekly, "2026-09-28", [
        "2026-09-21",
        "2026-09-14",
        "2026-08-31",
      ]),
    ).toBe(2);
  });

  it("finds the longest complete run in a range", () => {
    const summary = summarise({
      kind: ReviewKind.Daily,
      from: "2026-09-21",
      to: "2026-09-27",
      today: "2026-10-01",
      reviews: WEEK_39,
      reflectPromptIds: [WENT_WELL],
      completedStarts: [],
    });
    expect(bestStreakOf(summary.periods)).toBe(3);
  });
});

describe("summarise", () => {
  it("summarises week 39 against week 38, on 2026-10-01", () => {
    const week38 = ["14", "15", "16", "17", "18", "19", "20"].map((d) =>
      day(`2026-09-${d}`, [3, 3, 3, 3]),
    );
    const summary = summarise({
      kind: ReviewKind.Daily,
      from: "2026-09-21",
      to: "2026-09-27",
      today: "2026-10-01",
      reviews: [...week38, ...WEEK_39],
      reflectPromptIds: [WENT_WELL, DIDNT],
      completedStarts: ["2026-09-30", "2026-09-29", "2026-09-28", "2026-09-27"],
    });

    expect(summary.periods.map((p) => p.status)).toEqual([
      "complete",
      "complete",
      "complete",
      "missed",
      "complete",
      "complete",
      "complete",
    ]);
    expect(summary.periods[0]).toMatchObject({
      periodStart: "2026-09-21",
      periodEnd: "2026-09-21",
      current: false,
      reviewId: "review-2026-09-21",
      ratings: { overall: 4, mood: 4, energy: 4, focus: 4 },
      headline: "Weather plan approved.",
    });
    expect(summary.periods[3].reviewId).toBeUndefined();
    expect(summary.periods[3].ratings).toEqual({});
    expect(summary.averages.overall).toBe(3.67);
    expect(summary.previousAverages).toEqual({
      overall: 3,
      mood: 3,
      energy: 3,
      focus: 3,
    });
    expect(summary).toMatchObject({
      kind: "daily",
      today: "2026-10-01",
      complete: 6,
      drafts: 0,
      due: 7,
      currentStreak: 4,
      bestStreak: 3,
    });
  });

  it("marks today open and the rest of the week upcoming", () => {
    const summary = summarise({
      kind: ReviewKind.Daily,
      from: "2026-09-28",
      to: "2026-10-04",
      today: "2026-10-01",
      reviews: [day("2026-09-30", [4, 4, 3, 2], { completed: false })],
      reflectPromptIds: [],
      completedStarts: [],
    });
    expect(summary.periods.map((p) => [p.status, p.current])).toEqual([
      [ReviewPeriodStatus.Missed, false],
      [ReviewPeriodStatus.Missed, false],
      [ReviewPeriodStatus.Draft, false],
      [ReviewPeriodStatus.Open, true],
      [ReviewPeriodStatus.Upcoming, false],
      [ReviewPeriodStatus.Upcoming, false],
      [ReviewPeriodStatus.Upcoming, false],
    ]);
    expect(summary.due).toBe(4);
    expect(summary.drafts).toBe(1);
    expect(summary.averages).toEqual({});
  });

  it("summarises weeks, the current one by today's Monday", () => {
    const summary = summarise({
      kind: ReviewKind.Weekly,
      from: "2026-09-21",
      to: "2026-10-05",
      today: "2026-10-01",
      reviews: [],
      reflectPromptIds: [],
      completedStarts: [],
    });
    expect(
      summary.periods.map((p) => [p.periodStart, p.periodEnd, p.status]),
    ).toEqual([
      ["2026-09-21", "2026-09-27", "missed"],
      ["2026-09-28", "2026-10-04", "open"],
      ["2026-10-05", "2026-10-11", "upcoming"],
    ]);
  });
});
