import { describe, expect, it } from "vitest";
import { graphQlTag } from "../../../../fixtures/minerva";
import { toDomainObject } from "../../../../../src/minerva/tags/converters/TagConverter";

describe("TagConverter", () => {
  it("maps a row and parses its times", () => {
    const tag = toDomainObject(graphQlTag());
    expect(tag).toMatchObject({ name: "olympus", color: "#1677ff" });
    expect(tag.createdTime.toISOString()).toBe("2026-10-01T12:00:00.000Z");
    expect(tag.lastUpdatedTime?.toISOString()).toBe("2026-10-01T12:30:00.000Z");
  });

  it("maps nulls to undefined", () => {
    const tag = toDomainObject(
      graphQlTag({ color: null, lastUpdatedTime: null }),
    );
    expect(tag.color).toBeUndefined();
    expect(tag.lastUpdatedTime).toBeUndefined();
  });
});
