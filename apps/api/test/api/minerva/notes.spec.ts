import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { graphQlNote } from "../../fixtures/minerva";
import { createTestApp, type TestApp } from "../../support/testApp";

const NOTE_ID = "8f7d2c1e-0000-4000-8000-000000000001";

describe("Minerva notes API", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => t.reset());

  describe("POST /v1/minerva/notes (CreateNote)", () => {
    const body = {
      note: {
        author: "ncfritz",
        flagged: false,
        type: 1,
        value: "Remember the milk",
        title: "Shopping",
        associations: [{ itemId: "movie:603", itemType: "movie" }],
      },
    };

    it("creates the note and returns it with 201", async () => {
      t.graphql.on("CreateNote", {
        insert_minerva_notes_one: graphQlNote(),
      });

      const res = await t.http().post("/v1/minerva/notes").send(body);

      expect(res.status).toBe(201);
      expect(res.body.note).toMatchObject({
        id: NOTE_ID,
        title: "Shopping",
        childCount: 2,
        createdTime: "2026-09-01T10:00:00.000Z",
      });
      expect(res.headers.location).toContain(NOTE_ID);
      expect(t.graphql.calls("CreateNote")[0].variables).toMatchObject({
        author: "ncfritz",
        value: "Remember the milk",
        associations: body.note.associations,
        parentId: undefined,
      });
    });

    it("creates a child note under the given parent", async () => {
      t.graphql.on("CreateNote", {
        insert_minerva_notes_one: graphQlNote({ parent_id: "parent-1" }),
      });

      const res = await t
        .http()
        .post("/v1/minerva/note/parent-1/children")
        .send(body);

      expect(res.status).toBe(201);
      expect(res.body.note.hasParent).toBe(true);
      expect(t.graphql.calls("CreateNote")[0].variables).toMatchObject({
        parentId: "parent-1",
      });
    });
  });

  describe("GET /v1/minerva/note/:noteId (DescribeNote)", () => {
    it("returns the note", async () => {
      t.graphql.on("DescribeNote", { minerva_notes_by_pk: graphQlNote() });

      const res = await t.http().get(`/v1/minerva/note/${NOTE_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.note.id).toBe(NOTE_ID);
      expect(t.graphql.calls("DescribeNote")[0].variables).toEqual({
        id: NOTE_ID,
      });
    });

    it("answers 404 for an unknown note", async () => {
      t.graphql.on("DescribeNote", { minerva_notes_by_pk: null });

      const res = await t.http().get("/v1/minerva/note/missing");

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ statusCode: 404 });
    });
  });

  describe("PUT /v1/minerva/note/:noteId (UpdateNote)", () => {
    it("applies the changes", async () => {
      t.graphql.on("UpdateNote", {
        update_minerva_notes_by_pk: graphQlNote({ flagged: true }),
      });

      const res = await t
        .http()
        .put(`/v1/minerva/note/${NOTE_ID}`)
        .send({ note: { flagged: true } });

      expect(res.status).toBe(200);
      expect(res.body.note.flagged).toBe(true);
      expect(t.graphql.calls("UpdateNote")[0].variables).toEqual({
        id: NOTE_ID,
        changes: { flagged: true },
      });
    });

    it("answers 304 without touching Hasura for an empty change set", async () => {
      const res = await t
        .http()
        .put(`/v1/minerva/note/${NOTE_ID}`)
        .send({ note: {} });

      expect(res.status).toBe(304);
      expect(t.graphql.request).not.toHaveBeenCalled();
    });

    it("answers 404 for an unknown note", async () => {
      t.graphql.on("UpdateNote", { update_minerva_notes_by_pk: null });

      const res = await t
        .http()
        .put("/v1/minerva/note/missing")
        .send({ note: { flagged: true } });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /v1/minerva/note/:noteId (DeleteNote)", () => {
    it("soft deletes a live note", async () => {
      t.graphql
        .on("GetDeletedTime", { minerva_notes_by_pk: { deletedTime: null } })
        .on("SoftDeleteNote", {
          update_minerva_notes_by_pk: graphQlNote({
            deletedTime: "2026-09-18T00:00:00Z",
          }),
        });

      const res = await t.http().delete(`/v1/minerva/note/${NOTE_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.note.deletedTime).toBe("2026-09-18T00:00:00.000Z");
      expect(t.graphql.calls("HardDeleteNote")).toHaveLength(0);
    });

    it("hard deletes a note that is already soft deleted", async () => {
      t.graphql
        .on("GetDeletedTime", {
          minerva_notes_by_pk: { deletedTime: "2026-09-18T00:00:00Z" },
        })
        .on("HardDeleteNote", {
          update_minerva_notes: { affected_rows: 1 },
          delete_minerva_notes_by_pk: graphQlNote(),
        });

      const res = await t.http().delete(`/v1/minerva/note/${NOTE_ID}`);

      expect(res.status).toBe(204);
      expect(t.graphql.calls("HardDeleteNote")[0].variables).toEqual({
        id: NOTE_ID,
      });
    });

    it("answers 404 for an unknown note", async () => {
      t.graphql.on("GetDeletedTime", { minerva_notes_by_pk: null });

      const res = await t.http().delete("/v1/minerva/note/missing");

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /v1/minerva/note/:noteId (RestoreNote)", () => {
    it("clears the deleted time", async () => {
      t.graphql.on("RestoreNote", {
        update_minerva_notes_by_pk: graphQlNote(),
      });

      const res = await t.http().patch(`/v1/minerva/note/${NOTE_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.note.deletedTime).toBeUndefined();
    });

    it("answers 404 for an unknown note", async () => {
      t.graphql.on("RestoreNote", { update_minerva_notes_by_pk: null });

      const res = await t.http().patch("/v1/minerva/note/missing");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /v1/minerva/note/:noteId/children (ListChildNotes)", () => {
    it("lists the children of a note", async () => {
      t.graphql.on("ListChildNotes", {
        minerva_notes: [graphQlNote({ id: "child-1", parent_id: NOTE_ID })],
      });

      const res = await t.http().get(`/v1/minerva/note/${NOTE_ID}/children`);

      expect(res.status).toBe(200);
      expect(res.body.notes.map((n: { id: string }) => n.id)).toEqual([
        "child-1",
      ]);
      expect(t.graphql.calls("ListChildNotes")[0].document).toContain(
        `parent_id: {_eq: "${NOTE_ID}"}`,
      );
    });
  });

  describe("GET /v1/minerva/notes/:start (ListNotesForDay)", () => {
    it("lists top-level notes for the day", async () => {
      t.graphql.on("ListNotesForDay", { minerva_notes: [graphQlNote()] });

      const res = await t.http().get("/v1/minerva/notes/2026-09-01");

      expect(res.status).toBe(200);
      expect(res.body.notes).toHaveLength(1);
      const document = t.graphql.calls("ListNotesForDay")[0].document;
      expect(document).toContain("parent_id: {_is_null: true}");
      expect(document).toContain("createdTime: {_gte:");
    });
  });

  describe("GET /v1/minerva/notes/entity/:entityType/:entityId (GetNotesForEntity)", () => {
    it("lists the notes associated with an entity", async () => {
      t.graphql.on("GetNotesForEntity", {
        minerva_note_associations: [{ note: graphQlNote() }],
      });

      const res = await t.http().get("/v1/minerva/notes/entity/movie/603");

      expect(res.status).toBe(200);
      expect(res.body.notes[0].id).toBe(NOTE_ID);
      expect(t.graphql.calls("GetNotesForEntity")[0].variables).toEqual({
        entityType: "movie",
        entityId: "603",
      });
    });
  });

  describe("GET /v1/minerva/notes/summary/:start (GetNotesSummary)", () => {
    it("counts notes by day and hour in the caller's timezone", async () => {
      t.graphql
        .on("GetMonthlyCounts", {
          minerva_notes_type_statistics: [
            { created: "2026-09-18", type: 1, count: 3 },
            { created: "2026-09-17", type: 0, count: 2 },
          ],
        })
        .on("GetHourlyCounts", {
          minerva_notes_hour_statistics: [{ hour: "09", type: 1, count: 3 }],
        });

      const res = await t
        .http()
        .get("/v1/minerva/notes/summary/2026-09-18?days=1")
        .set("x-ncfritz-tz", "America/Los_Angeles");

      expect(res.status).toBe(200);
      expect(res.body.counts["2026-09-18"]).toMatchObject({
        idea: 3,
        total: 3,
      });
      expect(res.body.counts["2026-09-17"]).toMatchObject({
        note: 2,
        total: 2,
      });
      expect(res.body.hourly["09"]).toMatchObject({ idea: 3, total: 3 });
      expect(t.graphql.calls("GetMonthlyCounts")[0].variables).toMatchObject({
        tz: "America/Los_Angeles",
      });
    });

    it("defaults the timezone to UTC", async () => {
      t.graphql
        .on("GetMonthlyCounts", { minerva_notes_type_statistics: [] })
        .on("GetHourlyCounts", { minerva_notes_hour_statistics: [] });

      await t.http().get("/v1/minerva/notes/summary/2026-09-18?days=1");

      expect(t.graphql.calls("GetMonthlyCounts")[0].variables).toMatchObject({
        tz: "Etc/UTC",
      });
    });
  });
});
