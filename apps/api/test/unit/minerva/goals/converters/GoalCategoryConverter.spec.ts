import { describe, expect, it } from "vitest";
import { graphQlGoalCategory } from "../../../../fixtures/minerva";
import { toDomainObject } from "../../../../../src/minerva/goals/converters/GoalCategoryConverter";

describe("GoalCategoryConverter", () => {
  it("maps a row and parses its times", () => {
    const category = toDomainObject(graphQlGoalCategory());
    expect(category).toMatchObject({
      name: "Health",
      color: "#52c41a",
      icon: "heart",
      vision: "Strong enough to ride all day at 60.",
      position: 0,
      archived: false,
    });
    expect(category.archivedTime).toBeUndefined();
    expect(category.createdTime.toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });

  it("marks an archived category and maps nulls to undefined", () => {
    const category = toDomainObject(
      graphQlGoalCategory({
        vision: null,
        archivedTime: "2026-10-02T08:00:00Z",
        lastUpdatedTime: null,
      }),
    );
    expect(category.archived).toBe(true);
    expect(category.archivedTime?.toISOString()).toBe(
      "2026-10-02T08:00:00.000Z",
    );
    expect(category.vision).toBeUndefined();
    expect(category.lastUpdatedTime).toBeUndefined();
  });
});
