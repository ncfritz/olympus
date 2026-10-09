import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ClientError } from "graphql-request";
import * as jose from "jose";
import type { Test } from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { issueAccessToken } from "../../../src/auth/tokens/accessTokens";
import { SigningKeyService } from "../../../src/auth/tokens/SigningKeyService";
import { graphQlTag, TAG_ID } from "../../fixtures/minerva";
import { createTestApp, type TestApp } from "../../support/testApp";

const USER = "5f1a0c6e-0000-4000-8000-000000000001";
const OTHER_USER = "5f1a0c6e-0000-4000-8000-0000000000ff";
const SECOND_ID = "4c8e1f20-0000-4000-8000-000000000002";

/** What Hasura answers when a unique index refuses a row. */
const uniqueViolation = () => {
  throw new ClientError(
    {
      status: 200,
      errors: [
        {
          message: "Uniqueness violation",
          extensions: { code: "constraint-violation", path: "$" },
        },
      ],
    } as unknown as ConstructorParameters<typeof ClientError>[0],
    { query: "" },
  );
};

/**
 * The tag operations over the real HTTP stack. Every one is the caller's
 * own: the user comes from the access token, and every Hasura document is
 * scoped by it.
 */
describe("Tags API", () => {
  let t: TestApp;
  let token: string;

  const tokenFor = (sub: string) =>
    issueAccessToken(t.app.get(SigningKeyService).require(), {
      sub,
      clientId: "olympus-site",
      sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
      roles: ["user"],
      authTime: 1_790_000_000,
    });

  const as = (request: Test) => request.set("authorization", `Bearer ${token}`);

  beforeAll(async () => {
    const keys = mkdtempSync(join(tmpdir(), "auth-keys-"));
    const { privateKey } = await jose.generateKeyPair("ES256", {
      extractable: true,
    });
    writeFileSync(
      join(keys, "2026-01-01.pem"),
      await jose.exportPKCS8(privateKey),
    );
    t = await createTestApp({ env: { AUTH_SIGNING_KEYS: keys } });
    token = await tokenFor(USER);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    t.reset();
    token = await tokenFor(USER);
  });

  describe("without an identity", () => {
    it.each([
      ["get", "/v1/minerva/tags"],
      ["post", "/v1/minerva/tags"],
      ["get", `/v1/minerva/tag/${TAG_ID}`],
      ["put", `/v1/minerva/tag/${TAG_ID}`],
      ["delete", `/v1/minerva/tag/${TAG_ID}`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await t.http()[method](path);
        expect(res.status).toBe(401);
        expect(t.graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("ListTags", () => {
    it("lists the caller's tags by name", async () => {
      t.graphql.on("ListTags", {
        minerva_tags: [
          graphQlTag({ id: SECOND_ID, name: "family", color: null }),
          graphQlTag(),
        ],
      });

      const res = await as(t.http().get("/v1/minerva/tags"));

      expect(res.status).toBe(200);
      expect(res.body.tags.map((tag: { name: string }) => tag.name)).toEqual([
        "family",
        "olympus",
      ]);
      expect(res.body.tags[0].color).toBeUndefined();
      expect(t.graphql.calls("ListTags")[0].variables).toEqual({
        where: { userId: { _eq: USER } },
      });
    });

    it("filters by prefix, matching LIKE's own characters as text", async () => {
      t.graphql.on("ListTags", { minerva_tags: [] });

      const res = await as(
        t.http().get("/v1/minerva/tags").query({ prefix: "50%_off" }),
      );

      expect(res.status).toBe(200);
      expect(t.graphql.calls("ListTags")[0].variables).toEqual({
        where: {
          userId: { _eq: USER },
          name: { _ilike: "50\\%\\_off%" },
        },
      });
    });

    it("answers 400 for a prefix over 50 characters, before Hasura", async () => {
      const res = await as(
        t
          .http()
          .get("/v1/minerva/tags")
          .query({ prefix: "x".repeat(51) }),
      );

      expect(res.status).toBe(400);
      expect(t.graphql.request).not.toHaveBeenCalled();
    });

    it("answers 400 for a repeated prefix, before Hasura", async () => {
      const res = await as(t.http().get("/v1/minerva/tags?prefix=a&prefix=b"));

      expect(res.status).toBe(400);
      expect(t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DescribeTag", () => {
    it("returns the tag, scoped to the caller", async () => {
      t.graphql.on("DescribeTag", { minerva_tags: [graphQlTag()] });

      const res = await as(t.http().get(`/v1/minerva/tag/${TAG_ID}`));

      expect(res.status).toBe(200);
      expect(res.body.tag).toMatchObject({ id: TAG_ID, name: "olympus" });
      expect(t.graphql.calls("DescribeTag")[0].variables).toEqual({
        userId: USER,
        tagId: TAG_ID,
      });
    });

    it("answers 404 for someone else's tag", async () => {
      t.graphql.on("DescribeTag", { minerva_tags: [] });
      token = await tokenFor(OTHER_USER);

      const res = await as(t.http().get(`/v1/minerva/tag/${TAG_ID}`));

      expect(res.status).toBe(404);
      expect(t.graphql.calls("DescribeTag")[0].variables).toEqual({
        userId: OTHER_USER,
        tagId: TAG_ID,
      });
    });

    it("answers 400 for an id that is not a UUID, before Hasura", async () => {
      const res = await as(t.http().get("/v1/minerva/tag/nope"));

      expect(res.status).toBe(400);
      expect(t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("CreateTag", () => {
    it("creates the tag for the caller, trimmed, with a lowercase colour", async () => {
      t.graphql.on("CreateTag", { insert_minerva_tags_one: graphQlTag() });

      const res = await as(
        t
          .http()
          .post("/v1/minerva/tags")
          .send({ tag: { name: "  olympus ", color: "#1677FF" } }),
      );

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/v1/minerva/tag/${TAG_ID}`);
      expect(res.body.tag).toMatchObject({ id: TAG_ID, name: "olympus" });
      expect(t.graphql.calls("CreateTag")[0].variables).toEqual({
        object: { userId: USER, name: "olympus", color: "#1677ff" },
      });
    });

    it("creates a tag with no colour", async () => {
      t.graphql.on("CreateTag", {
        insert_minerva_tags_one: graphQlTag({ color: null }),
      });

      const res = await as(
        t
          .http()
          .post("/v1/minerva/tags")
          .send({ tag: { name: "olympus" } }),
      );

      expect(res.status).toBe(201);
      expect(t.graphql.calls("CreateTag")[0].variables).toEqual({
        object: { userId: USER, name: "olympus", color: null },
      });
    });

    it("answers 409 for a name the caller already has", async () => {
      t.graphql.on("CreateTag", uniqueViolation);

      const res = await as(
        t
          .http()
          .post("/v1/minerva/tags")
          .send({ tag: { name: "Olympus" } }),
      );

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("You already have a tag named Olympus");
    });

    it.each([
      ["no body", undefined],
      ["no tag", {}],
      ["a blank name", { tag: { name: "   " } }],
      ["a long name", { tag: { name: "x".repeat(51) } }],
      ["a name that is not text", { tag: { name: 7 } }],
      ["a colour that is not hex", { tag: { name: "a", color: "blue" } }],
      ["a short colour", { tag: { name: "a", color: "#fff" } }],
    ])("answers 400 for %s, before Hasura", async (_, body) => {
      const res = await as(t.http().post("/v1/minerva/tags").send(body));

      expect(res.status).toBe(400);
      expect(t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("UpdateTag", () => {
    it("renames the tag", async () => {
      t.graphql
        .on("DescribeTag", { minerva_tags: [graphQlTag()] })
        .on("UpdateTag", {
          update_minerva_tags: { returning: [graphQlTag({ name: "home" })] },
        });

      const res = await as(
        t
          .http()
          .put(`/v1/minerva/tag/${TAG_ID}`)
          .send({ tag: { name: "home" } }),
      );

      expect(res.status).toBe(200);
      expect(res.body.tag.name).toBe("home");
      expect(t.graphql.calls("UpdateTag")[0].variables).toEqual({
        userId: USER,
        tagId: TAG_ID,
        set: { name: "home" },
      });
    });

    it("removes the colour with null", async () => {
      t.graphql
        .on("DescribeTag", { minerva_tags: [graphQlTag()] })
        .on("UpdateTag", {
          update_minerva_tags: { returning: [graphQlTag({ color: null })] },
        });

      const res = await as(
        t
          .http()
          .put(`/v1/minerva/tag/${TAG_ID}`)
          .send({ tag: { color: null } }),
      );

      expect(res.status).toBe(200);
      expect(res.body.tag.color).toBeUndefined();
      expect(t.graphql.calls("UpdateTag")[0].variables).toMatchObject({
        set: { color: null },
      });
    });

    it("answers 304 for an empty change", async () => {
      t.graphql.on("DescribeTag", { minerva_tags: [graphQlTag()] });

      const res = await as(
        t.http().put(`/v1/minerva/tag/${TAG_ID}`).send({ tag: {} }),
      );

      expect(res.status).toBe(304);
      expect(t.graphql.calls("UpdateTag")).toHaveLength(0);
    });

    it("answers with the tag unchanged when nothing differs", async () => {
      t.graphql.on("DescribeTag", { minerva_tags: [graphQlTag()] });

      const res = await as(
        t
          .http()
          .put(`/v1/minerva/tag/${TAG_ID}`)
          .send({ tag: { name: "olympus", color: "#1677FF" } }),
      );

      expect(res.status).toBe(200);
      expect(res.body.tag.name).toBe("olympus");
      expect(t.graphql.calls("UpdateTag")).toHaveLength(0);
    });

    it("answers 409 when the new name is taken", async () => {
      t.graphql
        .on("DescribeTag", { minerva_tags: [graphQlTag()] })
        .on("UpdateTag", uniqueViolation);

      const res = await as(
        t
          .http()
          .put(`/v1/minerva/tag/${TAG_ID}`)
          .send({ tag: { name: "Family" } }),
      );

      expect(res.status).toBe(409);
    });

    it("answers 404 for someone else's tag, writing nothing", async () => {
      t.graphql.on("DescribeTag", { minerva_tags: [] });
      token = await tokenFor(OTHER_USER);

      const res = await as(
        t
          .http()
          .put(`/v1/minerva/tag/${TAG_ID}`)
          .send({ tag: { name: "mine" } }),
      );

      expect(res.status).toBe(404);
      expect(t.graphql.calls("UpdateTag")).toHaveLength(0);
    });

    it.each([
      ["no tag", {}],
      ["a blank name", { tag: { name: "" } }],
      ["a colour that is not hex", { tag: { color: "#12345g" } }],
    ])("answers 400 for %s, before Hasura", async (_, body) => {
      const res = await as(
        t.http().put(`/v1/minerva/tag/${TAG_ID}`).send(body),
      );

      expect(res.status).toBe(400);
      expect(t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DeleteTag", () => {
    it("deletes the caller's tag", async () => {
      t.graphql.on("DeleteTag", { delete_minerva_tags: { affected_rows: 1 } });

      const res = await as(t.http().delete(`/v1/minerva/tag/${TAG_ID}`));

      expect(res.status).toBe(204);
      expect(t.graphql.calls("DeleteTag")[0].variables).toEqual({
        userId: USER,
        tagId: TAG_ID,
      });
    });

    it("answers 404 for someone else's tag", async () => {
      t.graphql.on("DeleteTag", { delete_minerva_tags: { affected_rows: 0 } });
      token = await tokenFor(OTHER_USER);

      const res = await as(t.http().delete(`/v1/minerva/tag/${TAG_ID}`));

      expect(res.status).toBe(404);
    });

    it("answers 400 for an id that is not a UUID, before Hasura", async () => {
      const res = await as(t.http().delete("/v1/minerva/tag/nope"));

      expect(res.status).toBe(400);
      expect(t.graphql.request).not.toHaveBeenCalled();
    });
  });
});
