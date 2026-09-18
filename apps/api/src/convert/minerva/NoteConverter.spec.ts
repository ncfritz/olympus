import { describe, expect, it } from "vitest";
import { graphQlNote } from "../../../test/fixtures/minerva";
import { toDomainObject } from "./NoteConverter";

describe("NoteConverter.toDomainObject", () => {
  it("maps a note with associations", () => {
    const note = toDomainObject(graphQlNote());
    expect(note).toMatchObject({
      id: "8f7d2c1e-0000-4000-8000-000000000001",
      author: "ncfritz",
      flagged: false,
      title: "Shopping",
      summary: "Groceries",
      value: "Remember the milk",
      hasParent: false,
      childCount: 2,
      deletedTime: undefined,
    });
    expect(note.createdTime.toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect(note.lastUpdatedTime.toISOString()).toBe("2026-09-02T11:30:00.000Z");
    expect(note.associations).toHaveLength(1);
    expect(note.associations?.[0]).toMatchObject({
      itemId: "movie:603",
      itemType: "movie",
    });
    expect(note.associations?.[0]?.createdTime.toISOString()).toBe(
      "2026-09-01T10:05:00.000Z",
    );
  });

  it("reports a parent and a deleted time when present", () => {
    const note = toDomainObject(
      graphQlNote({ parent_id: "parent", deletedTime: "2026-09-03T00:00:00Z" }),
    );
    expect(note.hasParent).toBe(true);
    expect(note.deletedTime?.toISOString()).toBe("2026-09-03T00:00:00.000Z");
  });

  it("treats a null parent as no parent and missing associations as none", () => {
    const note = toDomainObject(
      graphQlNote({ parent_id: null as never, associatedItems: undefined }),
    );
    expect(note.hasParent).toBe(false);
    expect(note.associations).toEqual([]);
  });
});
