import { describe, expect, it } from "vitest";
import { toDomainObject } from "../../../../../src/minerva/reviews/converters/ReviewPinConverter";

describe("ReviewPinConverter", () => {
  it("maps an answer's pin and a note's", () => {
    const base = {
      id: "b0b0b0b0-0000-4000-8000-000000000001",
      reviewId: "7b3e1d00-0000-4000-8000-000000000002",
      createdTime: "2026-10-04T18:00:00Z",
      lastUpdatedTime: null,
    };
    const answer = toDomainObject({
      ...base,
      answerId: "9d5a3f00-0000-4000-8000-000000000001",
      noteId: null,
    });
    expect(answer.answerId).toBe("9d5a3f00-0000-4000-8000-000000000001");
    expect(answer.noteId).toBeUndefined();
    expect(answer.lastUpdatedTime).toBeUndefined();
    expect(answer.createdTime.toISOString()).toBe("2026-10-04T18:00:00.000Z");

    const note = toDomainObject({
      ...base,
      answerId: null,
      noteId: "c0ffee00-0000-4000-8000-000000000001",
    });
    expect(note.answerId).toBeUndefined();
    expect(note.noteId).toBe("c0ffee00-0000-4000-8000-000000000001");
  });
});
