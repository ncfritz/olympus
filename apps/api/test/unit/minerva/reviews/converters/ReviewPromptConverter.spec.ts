import { describe, expect, it } from "vitest";
import { graphQlReviewPrompt } from "../../../../fixtures/minerva";
import { toDomainObject } from "../../../../../src/minerva/reviews/converters/ReviewPromptConverter";

describe("ReviewPromptConverter", () => {
  it("maps a prompt and parses its times", () => {
    const prompt = toDomainObject(graphQlReviewPrompt());
    expect(prompt).toMatchObject({
      kind: "daily",
      section: "reflect",
      label: "What went well?",
      position: 0,
      archived: false,
    });
    expect(prompt.placeholder).toBeUndefined();
    expect(prompt.archivedTime).toBeUndefined();
    expect(prompt.createdTime.toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });

  it("marks an archived prompt and keeps its placeholder", () => {
    const prompt = toDomainObject(
      graphQlReviewPrompt({
        placeholder: "A hint",
        archivedTime: "2026-10-02T08:00:00Z",
      }),
    );
    expect(prompt.archived).toBe(true);
    expect(prompt.placeholder).toBe("A hint");
    expect(prompt.archivedTime?.toISOString()).toBe("2026-10-02T08:00:00.000Z");
  });
});
