import { describe, expect, it } from "vitest";
import { STARTER_PROMPTS } from "../../../src/minerva/reviews/services/ReviewPromptService";
import { graphQlReviewPrompt, REVIEW_PROMPT_ID } from "../../fixtures/minerva";
import {
  OTHER_USER,
  signedInApp,
  uniqueViolation,
  USER,
} from "../../support/signedInApp";

const BASE = "/v1/minerva/reviews";
const SECOND_ID = "8c4f2e00-0000-4000-8000-000000000002";
const PLAN_ID = "8c4f2e00-0000-4000-8000-000000000005";

/** The settings row: present once the starter prompts were given. */
const seeded = { starterPromptsTime: "2026-10-01T12:00:00Z" };

/** The caller's prompts: two daily Reflect, one daily Plan, one weekly. */
const prompts = () => [
  graphQlReviewPrompt(),
  graphQlReviewPrompt({
    id: SECOND_ID,
    label: "What didn’t go well?",
    position: 1,
  }),
  graphQlReviewPrompt({
    id: PLAN_ID,
    section: "plan",
    label: "Thoughts for tomorrow",
  }),
  graphQlReviewPrompt({
    id: "8c4f2e00-0000-4000-8000-000000000006",
    kind: "weekly",
    label: "Biggest win",
  }),
];

/**
 * The review prompt operations over the real HTTP stack. Every one is the
 * caller's own: the user comes from the access token, and every Hasura
 * document is scoped by it.
 */
describe("Review prompts API", () => {
  const ctx = signedInApp();

  const listed = (rows = prompts()) =>
    ctx.t.graphql.on("ListReviewPrompts", {
      minerva_review_prompts: rows,
      minerva_review_user_settings_by_pk: seeded,
    });

  describe("without an identity", () => {
    it.each([
      ["get", `${BASE}/prompts`],
      ["post", `${BASE}/prompts`],
      ["put", `${BASE}/prompts/order`],
      ["get", `${BASE}/prompt/${REVIEW_PROMPT_ID}`],
      ["put", `${BASE}/prompt/${REVIEW_PROMPT_ID}`],
      ["delete", `${BASE}/prompt/${REVIEW_PROMPT_ID}`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await ctx.t.http()[method](path);
        expect(res.status).toBe(401);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("ListReviewPrompts", () => {
    it("lists the caller's prompts in order", async () => {
      listed();

      const res = await ctx.as(ctx.t.http().get(`${BASE}/prompts`));

      expect(res.status).toBe(200);
      expect(
        res.body.reviewPrompts.map(
          (p: { kind: string; label: string }) => `${p.kind}: ${p.label}`,
        ),
      ).toEqual([
        "daily: What went well?",
        "daily: What didn’t go well?",
        "daily: Thoughts for tomorrow",
        "weekly: Biggest win",
      ]);
      expect(ctx.t.graphql.calls("ListReviewPrompts")[0].variables).toEqual({
        userId: USER,
      });
      expect(ctx.t.graphql.calls("GiveStarterReviewPrompts")).toHaveLength(0);
    });

    it("lists one kind's prompts", async () => {
      listed();

      const res = await ctx.as(ctx.t.http().get(`${BASE}/prompts?kind=weekly`));

      expect(res.status).toBe(200);
      expect(
        res.body.reviewPrompts.map((p: { label: string }) => p.label),
      ).toEqual(["Biggest win"]);
    });

    it("answers 400 for a kind it does not know, before Hasura", async () => {
      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/prompts?kind=monthly`),
      );
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it("gives a new user the starter prompts, once", async () => {
      let reads = 0;
      ctx.t.graphql
        .on("ListReviewPrompts", () => {
          reads += 1;
          return reads === 1
            ? {
                minerva_review_prompts: [],
                minerva_review_user_settings_by_pk: null,
              }
            : {
                minerva_review_prompts: prompts(),
                minerva_review_user_settings_by_pk: seeded,
              };
        })
        .on("GiveStarterReviewPrompts", {
          insert_minerva_review_user_settings_one: { userId: USER },
          insert_minerva_review_prompts: { affected_rows: 12 },
        });

      const res = await ctx.as(ctx.t.http().get(`${BASE}/prompts`));

      expect(res.status).toBe(200);
      const give = ctx.t.graphql.calls("GiveStarterReviewPrompts")[0]
        .variables as {
        settings: { userId: string };
        objects: {
          userId: string;
          kind: string;
          section: string;
          label: string;
          placeholder: string | null;
          position: number;
        }[];
      };
      expect(give.settings.userId).toBe(USER);
      expect(
        give.objects.map(
          (o) =>
            `${o.kind}/${o.section}/${o.position}: ${o.label} (${o.style})`,
        ),
      ).toEqual([
        "daily/reflect/0: What went well? (list)",
        "daily/reflect/1: What didn’t go well? (list)",
        "daily/reflect/2: What’s on my mind? (list)",
        "daily/reflect/3: Anything else about today (text)",
        "daily/plan/0: Thoughts for tomorrow (list)",
        "weekly/reflect/0: Biggest win (list)",
        "weekly/reflect/1: What got in the way (list)",
        "weekly/reflect/2: What I learned (list)",
        "weekly/reflect/3: What to change next week (list)",
        "weekly/plan/0: Theme for the week (text)",
        "weekly/plan/1: Start (text)",
        "weekly/plan/2: Stop (text)",
      ]);
      expect(give.objects).toHaveLength(STARTER_PROMPTS.length);
      expect(give.objects.every((o) => o.userId === USER)).toBe(true);
      expect(give.objects[2].placeholder).toContain("keep coming back to");
      expect(give.objects[0].placeholder).toBeNull();
    });

    it("puts the starters after prompts the user already has", async () => {
      let reads = 0;
      ctx.t.graphql
        .on("ListReviewPrompts", () => {
          reads += 1;
          return {
            minerva_review_prompts: [graphQlReviewPrompt({ position: 0 })],
            minerva_review_user_settings_by_pk: reads === 1 ? null : seeded,
          };
        })
        .on("GiveStarterReviewPrompts", {
          insert_minerva_review_user_settings_one: { userId: USER },
          insert_minerva_review_prompts: { affected_rows: 12 },
        });

      await ctx.as(ctx.t.http().get(`${BASE}/prompts`));

      const give = ctx.t.graphql.calls("GiveStarterReviewPrompts")[0]
        .variables as { objects: { section: string; position: number }[] };
      expect(give.objects[0].position).toBe(1);
      expect(give.objects[4]).toMatchObject({ section: "plan", position: 0 });
    });

    it("gives nothing when a concurrent first read got there first", async () => {
      let reads = 0;
      ctx.t.graphql
        .on("ListReviewPrompts", () => {
          reads += 1;
          return {
            minerva_review_prompts: reads === 1 ? [] : prompts(),
            minerva_review_user_settings_by_pk: reads === 1 ? null : seeded,
          };
        })
        .on("GiveStarterReviewPrompts", uniqueViolation);

      const res = await ctx.as(ctx.t.http().get(`${BASE}/prompts`));

      expect(res.status).toBe(200);
      expect(res.body.reviewPrompts).toHaveLength(4);
      expect(reads).toBe(2);
    });
  });

  describe("CreateReviewPrompt", () => {
    const create = (reviewPrompt: unknown) =>
      ctx.as(ctx.t.http().post(`${BASE}/prompts`).send({ reviewPrompt }));

    it("adds the prompt at the end of its section, with a Location header", async () => {
      listed().on("CreateReviewPrompt", {
        insert_minerva_review_prompts_one: graphQlReviewPrompt({
          label: "Who did I help?",
          position: 2,
        }),
      });

      const res = await create({
        kind: "daily",
        section: "reflect",
        label: "  Who did I help?  ",
        placeholder: "   ",
      });

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(
        `/v1/minerva/reviews/prompt/${REVIEW_PROMPT_ID}`,
      );
      expect(ctx.t.graphql.calls("CreateReviewPrompt")[0].variables).toEqual({
        object: {
          userId: USER,
          kind: "daily",
          section: "reflect",
          style: "text",
          label: "Who did I help?",
          placeholder: null,
          position: 2,
        },
      });
    });

    it("adds a list prompt", async () => {
      listed().on("CreateReviewPrompt", {
        insert_minerva_review_prompts_one: graphQlReviewPrompt({
          label: "Who did I help?",
          position: 2,
        }),
      });

      const res = await create({
        kind: "daily",
        section: "reflect",
        style: "list",
        label: "Who did I help?",
      });

      expect(res.status).toBe(201);
      expect(res.body.reviewPrompt.style).toBe("list");
      expect(
        ctx.t.graphql.calls("CreateReviewPrompt")[0].variables,
      ).toMatchObject({ object: { style: "list" } });
    });

    it("starts a section that is empty at 0", async () => {
      listed().on("CreateReviewPrompt", {
        insert_minerva_review_prompts_one: graphQlReviewPrompt({
          kind: "weekly",
          section: "plan",
        }),
      });

      await create({ kind: "weekly", section: "plan", label: "Protect" });

      expect(
        ctx.t.graphql.calls("CreateReviewPrompt")[0].variables,
      ).toMatchObject({ object: { position: 0 } });
    });

    it("answers 409 when another prompt took the position meanwhile", async () => {
      listed().on("CreateReviewPrompt", uniqueViolation);

      const res = await create({
        kind: "daily",
        section: "reflect",
        label: "Again",
      });

      expect(res.status).toBe(409);
    });

    it.each([
      ["no prompt", undefined],
      ["no kind", { section: "reflect", label: "Hm" }],
      ["a monthly kind", { kind: "monthly", section: "reflect", label: "Hm" }],
      [
        "a look-back section",
        { kind: "daily", section: "look_back", label: "Hm" },
      ],
      ["a blank label", { kind: "daily", section: "reflect", label: "  " }],
      [
        "a 121-character label",
        { kind: "daily", section: "reflect", label: "x".repeat(121) },
      ],
      [
        "a 201-character placeholder",
        {
          kind: "daily",
          section: "reflect",
          label: "Hm",
          placeholder: "x".repeat(201),
        },
      ],
    ])("answers 400 for %s, before Hasura", async (_, reviewPrompt) => {
      const res = await create(reviewPrompt);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DescribeReviewPrompt", () => {
    it("describes one of the caller's prompts", async () => {
      ctx.t.graphql.on("DescribeReviewPrompt", {
        minerva_review_prompts: [graphQlReviewPrompt()],
      });

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/prompt/${REVIEW_PROMPT_ID}`),
      );

      expect(res.status).toBe(200);
      expect(res.body.reviewPrompt.label).toBe("What went well?");
    });

    it("answers 404 for someone else's prompt", async () => {
      ctx.t.graphql.on("DescribeReviewPrompt", { minerva_review_prompts: [] });
      await ctx.signInAs(OTHER_USER);

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/prompt/${REVIEW_PROMPT_ID}`),
      );

      expect(res.status).toBe(404);
      expect(
        ctx.t.graphql.calls("DescribeReviewPrompt")[0].variables,
      ).toMatchObject({ userId: OTHER_USER });
    });
  });

  describe("UpdateReviewPrompt", () => {
    const update = (reviewPrompt: unknown) =>
      ctx.as(
        ctx.t
          .http()
          .put(`${BASE}/prompt/${REVIEW_PROMPT_ID}`)
          .send({ reviewPrompt }),
      );

    it("rewords and archives a prompt, sending only what changed", async () => {
      ctx.t.graphql
        .on("DescribeReviewPrompt", {
          minerva_review_prompts: [graphQlReviewPrompt()],
        })
        .on("UpdateReviewPrompt", {
          update_minerva_review_prompts: {
            returning: [
              graphQlReviewPrompt({
                label: "What went right?",
                placeholder: "Big or small",
                archivedTime: "2026-10-02T08:00:00Z",
              }),
            ],
          },
        });

      const res = await update({
        label: " What went right? ",
        placeholder: "Big or small",
        archived: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.reviewPrompt.archived).toBe(true);
      const set = (
        ctx.t.graphql.calls("UpdateReviewPrompt")[0].variables as {
          set: Record<string, unknown>;
        }
      ).set;
      expect(set.label).toBe("What went right?");
      expect(set.placeholder).toBe("Big or small");
      expect(typeof set.archivedTime).toBe("string");
    });

    it("makes a text prompt a list", async () => {
      ctx.t.graphql
        .on("DescribeReviewPrompt", {
          minerva_review_prompts: [graphQlReviewPrompt({ style: "text" })],
        })
        .on("UpdateReviewPrompt", {
          update_minerva_review_prompts: {
            returning: [graphQlReviewPrompt()],
          },
        });

      const res = await update({ style: "list" });

      expect(res.status).toBe(200);
      expect(ctx.t.graphql.calls("GetReviewPromptAnswerCounts")).toHaveLength(
        0,
      );
      expect(
        ctx.t.graphql.calls("UpdateReviewPrompt")[0].variables,
      ).toMatchObject({ set: { style: "list" } });
    });

    it("makes a list prompt text while no review holds two items", async () => {
      ctx.t.graphql
        .on("DescribeReviewPrompt", {
          minerva_review_prompts: [graphQlReviewPrompt()],
        })
        .on("GetReviewPromptAnswerCounts", { minerva_review_answers: [] })
        .on("UpdateReviewPrompt", {
          update_minerva_review_prompts: {
            returning: [graphQlReviewPrompt({ style: "text" })],
          },
        });

      const res = await update({ style: "text" });

      expect(res.status).toBe(200);
      expect(
        ctx.t.graphql.calls("GetReviewPromptAnswerCounts")[0].variables,
      ).toEqual({ userId: USER, promptId: REVIEW_PROMPT_ID });
    });

    it("answers 409 making a list text while a review holds two items", async () => {
      ctx.t.graphql
        .on("DescribeReviewPrompt", {
          minerva_review_prompts: [graphQlReviewPrompt()],
        })
        .on("GetReviewPromptAnswerCounts", {
          minerva_review_answers: [
            { id: "9d5a3f00-0000-4000-8000-000000000002" },
          ],
        });

      const res = await update({ style: "text" });

      expect(res.status).toBe(409);
      expect(ctx.t.graphql.calls("UpdateReviewPrompt")).toHaveLength(0);
    });

    it("brings an archived prompt back and removes its placeholder", async () => {
      ctx.t.graphql
        .on("DescribeReviewPrompt", {
          minerva_review_prompts: [
            graphQlReviewPrompt({
              placeholder: "Old hint",
              archivedTime: "2026-10-02T08:00:00Z",
            }),
          ],
        })
        .on("UpdateReviewPrompt", {
          update_minerva_review_prompts: {
            returning: [graphQlReviewPrompt()],
          },
        });

      await update({ placeholder: null, archived: false });

      expect(ctx.t.graphql.calls("UpdateReviewPrompt")[0].variables).toEqual({
        userId: USER,
        promptId: REVIEW_PROMPT_ID,
        set: { placeholder: null, archivedTime: null },
      });
    });

    it("answers 304 for a body that names nothing", async () => {
      ctx.t.graphql.on("DescribeReviewPrompt", {
        minerva_review_prompts: [graphQlReviewPrompt()],
      });

      expect((await update({})).status).toBe(304);
    });

    it("answers 404 for someone else's prompt, writing nothing", async () => {
      ctx.t.graphql.on("DescribeReviewPrompt", { minerva_review_prompts: [] });
      await ctx.signInAs(OTHER_USER);

      const res = await update({ label: "Mine now" });

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("UpdateReviewPrompt")).toHaveLength(0);
    });

    it.each([
      ["no prompt", undefined],
      ["a blank label", { label: "" }],
      ["a style that is neither", { style: "essay" }],
      ["archived as text", { archived: "yes" }],
    ])("answers 400 for %s, before Hasura", async (_, reviewPrompt) => {
      const res = await update(reviewPrompt);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DeleteReviewPrompt", () => {
    const remove = () =>
      ctx.as(ctx.t.http().delete(`${BASE}/prompt/${REVIEW_PROMPT_ID}`));
    const use = (found: boolean, answers: number) => ({
      minerva_review_prompts: found ? [{ id: REVIEW_PROMPT_ID }] : [],
      minerva_review_answers_aggregate: { aggregate: { count: answers } },
    });

    it("deletes a prompt that was never answered", async () => {
      ctx.t.graphql
        .on("GetReviewPromptUse", use(true, 0))
        .on("DeleteReviewPrompt", {
          delete_minerva_review_prompts: { affected_rows: 1 },
        });

      expect((await remove()).status).toBe(204);
      expect(ctx.t.graphql.calls("DeleteReviewPrompt")[0].variables).toEqual({
        userId: USER,
        promptId: REVIEW_PROMPT_ID,
      });
    });

    it("answers 409 for a prompt with answers, deleting nothing", async () => {
      ctx.t.graphql.on("GetReviewPromptUse", use(true, 3));

      const res = await remove();

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("3 answers");
      expect(ctx.t.graphql.calls("DeleteReviewPrompt")).toHaveLength(0);
    });

    it("answers 404 for someone else's prompt", async () => {
      ctx.t.graphql.on("GetReviewPromptUse", use(false, 0));
      await ctx.signInAs(OTHER_USER);

      expect((await remove()).status).toBe(404);
      expect(ctx.t.graphql.calls("DeleteReviewPrompt")).toHaveLength(0);
    });
  });

  describe("ReorderReviewPrompts", () => {
    const reorder = (body: object) =>
      ctx.as(ctx.t.http().put(`${BASE}/prompts/order`).send(body));

    it("reorders one section's prompts", async () => {
      listed().on("ReorderReviewPrompts", {
        update_minerva_review_prompts_many: [{ affected_rows: 1 }],
      });

      const res = await reorder({
        kind: "daily",
        section: "reflect",
        promptIds: [SECOND_ID, REVIEW_PROMPT_ID],
      });

      expect(res.status).toBe(200);
      expect(res.body.reviewPrompts).toHaveLength(4);
      expect(ctx.t.graphql.calls("ReorderReviewPrompts")[0].variables).toEqual({
        updates: [
          {
            where: { id: { _eq: SECOND_ID }, userId: { _eq: USER } },
            _set: { position: 0 },
          },
          {
            where: { id: { _eq: REVIEW_PROMPT_ID }, userId: { _eq: USER } },
            _set: { position: 1 },
          },
        ],
      });
    });

    it.each([
      ["one missing", [REVIEW_PROMPT_ID]],
      ["one twice", [REVIEW_PROMPT_ID, REVIEW_PROMPT_ID]],
      ["one from another section", [REVIEW_PROMPT_ID, SECOND_ID, PLAN_ID]],
    ])("answers 400 with %s, writing nothing", async (_, promptIds) => {
      listed();

      const res = await reorder({
        kind: "daily",
        section: "reflect",
        promptIds,
      });

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("ReorderReviewPrompts")).toHaveLength(0);
    });

    it.each([
      ["no kind", { section: "reflect", promptIds: [] }],
      ["no section", { kind: "daily", promptIds: [] }],
      ["no IDs", { kind: "daily", section: "reflect" }],
    ])("answers 400 for %s, before Hasura", async (_, body) => {
      const res = await reorder(body);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });
});
