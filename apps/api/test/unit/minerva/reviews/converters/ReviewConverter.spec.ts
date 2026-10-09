import { describe, expect, it } from "vitest";
import {
  graphQlReview,
  graphQlReviewAnswer,
} from "../../../../fixtures/minerva";
import { toDomainObject } from "../../../../../src/minerva/reviews/converters/ReviewConverter";

describe("ReviewConverter", () => {
  it("maps a draft daily review, its period and its answers", () => {
    const review = toDomainObject(graphQlReview());
    expect(review).toMatchObject({
      kind: "daily",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-01",
      step: 2,
      overall: 4,
      focus: 2,
      completed: false,
    });
    expect(review.progress).toBeUndefined();
    expect(review.balance).toBeUndefined();
    expect(review.completedTime).toBeUndefined();
    expect(review.answers).toHaveLength(1);
    expect(review.answers[0]).toMatchObject({
      promptId: "8c4f2e00-0000-4000-8000-000000000001",
      editedLater: false,
    });
    expect(review.createdTime.toISOString()).toBe("2026-10-01T21:00:00.000Z");
  });

  it("ends a week on its Sunday", () => {
    const review = toDomainObject(
      graphQlReview({
        kind: "weekly",
        periodStart: "2026-09-28",
        mood: null,
        energy: null,
        focus: null,
        progress: 4,
        balance: 2,
      }),
    );
    expect(review.periodEnd).toBe("2026-10-04");
    expect(review.mood).toBeUndefined();
    expect(review.balance).toBe(2);
  });

  it("marks answers written or changed after completion as edited later", () => {
    const review = toDomainObject(
      graphQlReview({
        completedTime: "2026-10-01T22:00:00Z",
        answers: [
          graphQlReviewAnswer({ lastUpdatedTime: "2026-10-01T21:59:00Z" }),
          graphQlReviewAnswer({
            id: "9d5a3f00-0000-4000-8000-000000000002",
            createdTime: "2026-10-01T21:10:00Z",
            lastUpdatedTime: "2026-10-02T07:00:00Z",
          }),
          graphQlReviewAnswer({
            id: "9d5a3f00-0000-4000-8000-000000000003",
            createdTime: "2026-10-02T08:00:00Z",
            lastUpdatedTime: null,
          }),
        ],
      }),
    );
    expect(review.completed).toBe(true);
    expect(review.completedTime?.toISOString()).toBe(
      "2026-10-01T22:00:00.000Z",
    );
    expect(review.answers.map((a) => a.editedLater)).toEqual([
      false,
      true,
      true,
    ]);
    expect(review.answers[2].lastUpdatedTime).toBeUndefined();
  });
});
