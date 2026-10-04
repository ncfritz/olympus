import { describe, expect, it } from "vitest";
import { graphQlNote } from "../../fixtures/minerva";
import { OTHER_USER, signedInApp, USER } from "../../support/signedInApp";

const NOTE_ID = "8f7d2c1e-0000-4000-8000-000000000001";
const PARENT_ID = "8f7d2c1e-0000-4000-8000-0000000000aa";

/**
 * The note operations over the real HTTP stack. Notes belong to a user
 * (ADR 0028): each operation needs an identity and asks Hasura only for the
 * caller's notes.
 */
describe("Minerva notes API", () => {
  const ctx = signedInApp();
  const t = () => ctx.t;

  describe("without an identity", () => {
    it.each([
      ["post", "/v1/minerva/notes"],
      ["post", `/v1/minerva/note/${PARENT_ID}/children`],
      ["get", `/v1/minerva/note/${NOTE_ID}`],
      ["put", `/v1/minerva/note/${NOTE_ID}`],
      ["delete", `/v1/minerva/note/${NOTE_ID}`],
      ["patch", `/v1/minerva/note/${NOTE_ID}`],
      ["get", `/v1/minerva/note/${NOTE_ID}/children`],
      ["get", "/v1/minerva/notes/2026-09-01"],
      ["get", "/v1/minerva/notes/entity/movie/603"],
      ["get", "/v1/minerva/notes/summary/2026-09-18?days=1"],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await t().http()[method](path);
        expect(res.status).toBe(401);
        expect(t().graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("POST /v1/minerva/notes (CreateNote)", () => {
    const body = {
      note: {
        flagged: false,
        type: 1,
        value: "Remember the milk",
        title: "Shopping",
        associations: [{ itemId: "movie:603", itemType: "movie" }],
      },
    };

    it("creates the caller's note and returns it with 201", async () => {
      t().graphql.on("CreateNote", {
        insert_minerva_notes_one: graphQlNote(),
      });

      const res = await ctx.as(t().http().post("/v1/minerva/notes").send(body));

      expect(res.status).toBe(201);
      expect(res.body.note).toMatchObject({
        id: NOTE_ID,
        title: "Shopping",
        childCount: 2,
        createdTime: "2026-09-01T10:00:00.000Z",
      });
      expect(res.headers.location).toBe(`/v1/minerva/note/${NOTE_ID}`);
      expect(t().graphql.calls("CreateNote")[0].variables).toMatchObject({
        userId: USER,
        value: "Remember the milk",
        associations: [
          { itemId: "movie:603", itemType: "movie", userId: USER },
        ],
        parentId: undefined,
      });
      expect(t().graphql.calls("GetOwnNote")).toHaveLength(0);
    });

    it("ignores an author an older client still sends", async () => {
      t().graphql.on("CreateNote", {
        insert_minerva_notes_one: graphQlNote(),
      });

      const res = await ctx.as(
        t()
          .http()
          .post("/v1/minerva/notes")
          .send({ note: { ...body.note, author: "ncfritz" } }),
      );

      expect(res.status).toBe(201);
      expect(res.body.note).not.toHaveProperty("author");
      const call = t().graphql.calls("CreateNote")[0];
      expect(call.variables).not.toHaveProperty("author");
      expect(call.document).not.toMatch(/\bauthor\b/);
    });

    it("creates a child note under the caller's own parent", async () => {
      t()
        .graphql.on("GetOwnNote", { minerva_notes: [{ id: PARENT_ID }] })
        .on("CreateNote", {
          insert_minerva_notes_one: graphQlNote({ parent_id: PARENT_ID }),
        });

      const res = await ctx.as(
        t().http().post(`/v1/minerva/note/${PARENT_ID}/children`).send(body),
      );

      expect(res.status).toBe(201);
      expect(res.body.note.hasParent).toBe(true);
      expect(res.headers.location).toBe(`/v1/minerva/note/${NOTE_ID}`);
      expect(t().graphql.calls("GetOwnNote")[0].variables).toEqual({
        id: PARENT_ID,
        userId: USER,
      });
      expect(t().graphql.calls("CreateNote")[0].variables).toMatchObject({
        parentId: PARENT_ID,
        userId: USER,
      });
    });

    it("answers 404 for a parent that is another user's, creating nothing", async () => {
      t().graphql.on("GetOwnNote", { minerva_notes: [] });

      const res = await ctx.as(
        t().http().post(`/v1/minerva/note/${PARENT_ID}/children`).send(body),
      );

      expect(res.status).toBe(404);
      expect(t().graphql.calls("CreateNote")).toHaveLength(0);
    });
  });

  describe("GET /v1/minerva/note/:noteId (DescribeNote)", () => {
    it("returns the caller's note", async () => {
      t().graphql.on("DescribeNote", { minerva_notes: [graphQlNote()] });

      const res = await ctx.as(t().http().get(`/v1/minerva/note/${NOTE_ID}`));

      expect(res.status).toBe(200);
      expect(res.body.note.id).toBe(NOTE_ID);
      expect(t().graphql.calls("DescribeNote")[0].variables).toEqual({
        id: NOTE_ID,
        userId: USER,
      });
    });

    it("answers 404 for an unknown note or another user's", async () => {
      await ctx.signInAs(OTHER_USER);
      t().graphql.on("DescribeNote", { minerva_notes: [] });

      const res = await ctx.as(t().http().get(`/v1/minerva/note/${NOTE_ID}`));

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ statusCode: 404 });
      expect(t().graphql.calls("DescribeNote")[0].variables).toEqual({
        id: NOTE_ID,
        userId: OTHER_USER,
      });
    });
  });

  describe("PUT /v1/minerva/note/:noteId (UpdateNote)", () => {
    it("applies the changes to the caller's note", async () => {
      t().graphql.on("UpdateNote", {
        update_minerva_notes: { returning: [graphQlNote({ flagged: true })] },
      });

      const res = await ctx.as(
        t()
          .http()
          .put(`/v1/minerva/note/${NOTE_ID}`)
          .send({ note: { flagged: true } }),
      );

      expect(res.status).toBe(200);
      expect(res.body.note.flagged).toBe(true);
      expect(t().graphql.calls("UpdateNote")[0].variables).toEqual({
        id: NOTE_ID,
        userId: USER,
        changes: { flagged: true },
      });
    });

    it("never changes the note's ID or owner", async () => {
      t().graphql.on("UpdateNote", {
        update_minerva_notes: { returning: [graphQlNote()] },
      });

      await ctx.as(
        t()
          .http()
          .put(`/v1/minerva/note/${NOTE_ID}`)
          .send({
            note: {
              flagged: true,
              id: PARENT_ID,
              userId: OTHER_USER,
              user_id: OTHER_USER,
            },
          }),
      );

      expect(t().graphql.calls("UpdateNote")[0].variables).toMatchObject({
        changes: { flagged: true },
      });
    });

    it("answers 304 without touching Hasura for an empty change set", async () => {
      const res = await ctx.as(
        t().http().put(`/v1/minerva/note/${NOTE_ID}`).send({ note: {} }),
      );

      expect(res.status).toBe(304);
      expect(t().graphql.request).not.toHaveBeenCalled();
    });

    it("answers 404 for an unknown note or another user's", async () => {
      t().graphql.on("UpdateNote", { update_minerva_notes: { returning: [] } });

      const res = await ctx.as(
        t()
          .http()
          .put(`/v1/minerva/note/${NOTE_ID}`)
          .send({ note: { flagged: true } }),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /v1/minerva/note/:noteId (DeleteNote)", () => {
    it("soft deletes the caller's live note", async () => {
      t()
        .graphql.on("GetDeletedTime", {
          minerva_notes: [{ deletedTime: null }],
        })
        .on("SoftDeleteNote", {
          update_minerva_notes: {
            returning: [graphQlNote({ deletedTime: "2026-09-18T00:00:00Z" })],
          },
        });

      const res = await ctx.as(
        t().http().delete(`/v1/minerva/note/${NOTE_ID}`),
      );

      expect(res.status).toBe(200);
      expect(res.body.note.deletedTime).toBe("2026-09-18T00:00:00.000Z");
      expect(t().graphql.calls("GetDeletedTime")[0].variables).toEqual({
        id: NOTE_ID,
        userId: USER,
      });
      expect(t().graphql.calls("SoftDeleteNote")[0].variables).toMatchObject({
        id: NOTE_ID,
        userId: USER,
      });
      expect(t().graphql.calls("HardDeleteNote")).toHaveLength(0);
    });

    it("hard deletes a note that is already soft deleted", async () => {
      t()
        .graphql.on("GetDeletedTime", {
          minerva_notes: [{ deletedTime: "2026-09-18T00:00:00Z" }],
        })
        .on("HardDeleteNote", {
          update_minerva_notes: { affected_rows: 1 },
          delete_minerva_notes: { returning: [graphQlNote()] },
        });

      const res = await ctx.as(
        t().http().delete(`/v1/minerva/note/${NOTE_ID}`),
      );

      expect(res.status).toBe(204);
      expect(t().graphql.calls("HardDeleteNote")[0].variables).toEqual({
        id: NOTE_ID,
        userId: USER,
      });
    });

    it("answers 404 for an unknown note or another user's", async () => {
      t().graphql.on("GetDeletedTime", { minerva_notes: [] });

      const res = await ctx.as(
        t().http().delete(`/v1/minerva/note/${NOTE_ID}`),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /v1/minerva/note/:noteId (RestoreNote)", () => {
    it("clears the deleted time of the caller's note", async () => {
      t().graphql.on("RestoreNote", {
        update_minerva_notes: { returning: [graphQlNote()] },
      });

      const res = await ctx.as(t().http().patch(`/v1/minerva/note/${NOTE_ID}`));

      expect(res.status).toBe(200);
      expect(res.body.note.deletedTime).toBeUndefined();
      expect(t().graphql.calls("RestoreNote")[0].variables).toEqual({
        id: NOTE_ID,
        userId: USER,
      });
    });

    it("answers 404 for an unknown note or another user's", async () => {
      t().graphql.on("RestoreNote", {
        update_minerva_notes: { returning: [] },
      });

      const res = await ctx.as(t().http().patch(`/v1/minerva/note/${NOTE_ID}`));

      expect(res.status).toBe(404);
    });
  });

  describe("GET /v1/minerva/note/:noteId/children (ListChildNotes)", () => {
    it("lists the children of the caller's note", async () => {
      t().graphql.on("ListChildNotes", {
        minerva_notes: [graphQlNote({ id: "child-1", parent_id: NOTE_ID })],
      });

      const res = await ctx.as(
        t().http().get(`/v1/minerva/note/${NOTE_ID}/children`),
      );

      expect(res.status).toBe(200);
      expect(res.body.notes.map((n: { id: string }) => n.id)).toEqual([
        "child-1",
      ]);
      const document = t().graphql.calls("ListChildNotes")[0].document;
      expect(document).toContain(`parent_id: {_eq: "${NOTE_ID}"}`);
      expect(document).toContain(`userId: {_eq: "${USER}"}`);
      expect(document).not.toContain("author: {_eq");
    });
  });

  describe("GET /v1/minerva/notes/:start (ListNotesForDay)", () => {
    it("lists the caller's top-level notes for the day", async () => {
      t().graphql.on("ListNotesForDay", { minerva_notes: [graphQlNote()] });

      const res = await ctx.as(t().http().get("/v1/minerva/notes/2026-09-01"));

      expect(res.status).toBe(200);
      expect(res.body.notes).toHaveLength(1);
      const document = t().graphql.calls("ListNotesForDay")[0].document;
      expect(document).toContain("parent_id: {_is_null: true}");
      expect(document).toContain("createdTime: {_gte:");
      expect(document).toContain(`userId: {_eq: "${USER}"}`);
    });
  });

  describe("GET /v1/minerva/notes/entity/:entityType/:entityId (GetNotesForEntity)", () => {
    it("lists the caller's notes associated with an entity", async () => {
      t().graphql.on("GetNotesForEntity", {
        minerva_note_associations: [{ note: graphQlNote() }],
      });

      const res = await ctx.as(
        t().http().get("/v1/minerva/notes/entity/movie/603"),
      );

      expect(res.status).toBe(200);
      expect(res.body.notes[0].id).toBe(NOTE_ID);
      expect(t().graphql.calls("GetNotesForEntity")[0].variables).toEqual({
        entityType: "movie",
        entityId: "603",
        userId: USER,
      });
    });
  });

  describe("GET /v1/minerva/notes/summary/:start (GetNotesSummary)", () => {
    it("counts the caller's notes by day and hour in the caller's timezone", async () => {
      t()
        .graphql.on("GetMonthlyCounts", {
          minerva_notes_type_statistics: [
            { created: "2026-09-18", type: 1, count: 3 },
            { created: "2026-09-17", type: 0, count: 2 },
          ],
        })
        .on("GetHourlyCounts", {
          minerva_notes_hour_statistics: [{ hour: "09", type: 1, count: 3 }],
        });

      const res = await ctx.as(
        t()
          .http()
          .get("/v1/minerva/notes/summary/2026-09-18?days=1")
          .set("x-ncfritz-tz", "America/Los_Angeles"),
      );

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
      expect(t().graphql.calls("GetMonthlyCounts")[0].variables).toMatchObject({
        userId: USER,
        tz: "America/Los_Angeles",
      });
      expect(t().graphql.calls("GetHourlyCounts")[0].variables).toMatchObject({
        userId: USER,
      });
    });

    it("defaults the timezone to UTC", async () => {
      t()
        .graphql.on("GetMonthlyCounts", { minerva_notes_type_statistics: [] })
        .on("GetHourlyCounts", { minerva_notes_hour_statistics: [] });

      await ctx.as(
        t().http().get("/v1/minerva/notes/summary/2026-09-18?days=1"),
      );

      expect(t().graphql.calls("GetMonthlyCounts")[0].variables).toMatchObject({
        tz: "Etc/UTC",
      });
    });
  });
});
