import { describe, expect, it } from "vitest";
import {
  graphQlReviewAnswer,
  graphQlReviewItem,
  REVIEW_ANSWER_ID,
  REVIEW_ID,
  REVIEW_ITEM_ID,
  REVIEW_PROMPT_ID,
} from "../../fixtures/minerva";
import {
  OTHER_USER,
  signedInApp,
  uniqueViolation,
  USER,
} from "../../support/signedInApp";

const BASE = "/v1/minerva";
const TEXT_PROMPT_ID = "8c4f2e00-0000-4000-8000-000000000004";
const WEEKLY_PROMPT_ID = "8c4f2e00-0000-4000-8000-000000000009";
const SECOND_ID = "9d5a3f00-0000-4000-8000-000000000002";
const THIRD_ID = "9d5a3f00-0000-4000-8000-000000000003";

/** Wednesday's "What went well?": three items, in order. */
const items = () => [
  graphQlReviewAnswer({ body: "Design review landed" }),
  graphQlReviewAnswer({ id: SECOND_ID, body: "Vendor call", position: 1 }),
  graphQlReviewAnswer({ id: THIRD_ID, body: "Lunch outside", position: 2 }),
];

/**
 * The answers to a review's prompts over the real HTTP stack: a text
 * prompt's one answer, and a list prompt's items (ADR 0027).
 */
describe("Review answers API", () => {
  const ctx = signedInApp();

  /** What GetReviewAnswerContext finds: the review and its answers, the prompt. */
  const context = ({
    review = { kind: "daily", completedTime: null } as {
      kind: string;
      completedTime: string | null;
    } | null,
    answers = items(),
    prompt = { kind: "daily", style: "list" } as {
      kind: string;
      style: string;
    } | null,
  } = {}) => ({
    minerva_reviews: review ? [{ ...review, answers }] : [],
    minerva_review_prompts: prompt ? [prompt] : [],
  });
  const answerPath = (promptId = REVIEW_PROMPT_ID) =>
    `${BASE}/review/${REVIEW_ID}/answer/${promptId}`;
  const itemPath = (answerId = REVIEW_ANSWER_ID) =>
    `${answerPath()}/item/${answerId}`;

  describe("without an identity", () => {
    it.each([
      ["put", answerPath(TEXT_PROMPT_ID)],
      ["post", `${answerPath()}/items`],
      ["put", `${answerPath()}/items/order`],
      ["put", itemPath()],
      ["delete", itemPath()],
      ["post", `${itemPath()}/todo`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await ctx.t.http()[method](path);
        expect(res.status).toBe(401);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("UpdateReviewAnswer: a text prompt", () => {
    const save = (body: unknown) =>
      ctx.as(
        ctx.t.http().put(answerPath(TEXT_PROMPT_ID)).send({ answer: { body } }),
      );
    const text = (answers = [] as ReturnType<typeof items>) =>
      context({ prompt: { kind: "daily", style: "text" }, answers });

    it("writes the first answer, trimmed, at 0", async () => {
      ctx.t.graphql
        .on("GetReviewAnswerContext", text())
        .on("CreateReviewAnswer", {
          insert_minerva_review_answers_one: graphQlReviewAnswer({
            promptId: TEXT_PROMPT_ID,
          }),
        });

      const res = await save("  A long day.  \n");

      expect(res.status).toBe(200);
      expect(res.body.answer).toMatchObject({
        promptId: TEXT_PROMPT_ID,
        position: 0,
        editedLater: false,
      });
      expect(ctx.t.graphql.calls("CreateReviewAnswer")[0].variables).toEqual({
        object: {
          reviewId: REVIEW_ID,
          promptId: TEXT_PROMPT_ID,
          userId: USER,
          kind: "daily",
          body: "A long day.",
          position: 0,
        },
      });
      expect(
        ctx.t.graphql.calls("GetReviewAnswerContext")[0].variables,
      ).toEqual({
        userId: USER,
        reviewId: REVIEW_ID,
        promptId: TEXT_PROMPT_ID,
      });
    });

    it("rewrites an answer in its row, so it keeps its created time", async () => {
      ctx.t.graphql
        .on("GetReviewAnswerContext", text([graphQlReviewAnswer()]))
        .on("UpdateReviewAnswer", {
          update_minerva_review_answers: {
            returning: [graphQlReviewAnswer({ body: "A long, good day." })],
          },
        });

      const res = await save("A long, good day.");

      expect(res.status).toBe(200);
      expect(ctx.t.graphql.calls("CreateReviewAnswer")).toHaveLength(0);
      expect(ctx.t.graphql.calls("UpdateReviewAnswer")[0].variables).toEqual({
        userId: USER,
        answerId: REVIEW_ANSWER_ID,
        body: "A long, good day.",
      });
    });

    it("marks an answer saved after completion as edited later", async () => {
      ctx.t.graphql
        .on(
          "GetReviewAnswerContext",
          context({
            review: { kind: "daily", completedTime: "2026-10-01T22:00:00Z" },
            prompt: { kind: "daily", style: "text" },
            answers: [],
          }),
        )
        .on("CreateReviewAnswer", {
          insert_minerva_review_answers_one: graphQlReviewAnswer({
            createdTime: "2026-10-02T06:30:00Z",
            lastUpdatedTime: "2026-10-02T06:30:00Z",
          }),
        });

      const res = await save("Added the next morning.");

      expect(res.body.answer.editedLater).toBe(true);
    });

    it.each([[""], ["   \n\t "]])(
      "removes the answer for a body of %j, answering 204",
      async (body) => {
        ctx.t.graphql
          .on("GetReviewAnswerContext", text([graphQlReviewAnswer()]))
          .on("RemoveReviewAnswer", {
            delete_minerva_review_answers: { affected_rows: 1 },
          });

        const res = await save(body);

        expect(res.status).toBe(204);
        expect(ctx.t.graphql.calls("RemoveReviewAnswer")[0].variables).toEqual({
          userId: USER,
          reviewId: REVIEW_ID,
          promptId: TEXT_PROMPT_ID,
        });
      },
    );

    it("answers 204 for an empty body with nothing to remove", async () => {
      ctx.t.graphql.on("GetReviewAnswerContext", text());

      expect((await save("")).status).toBe(204);
      expect(ctx.t.graphql.calls("RemoveReviewAnswer")).toHaveLength(0);
    });

    it("answers 409 when another answer was written at the same time", async () => {
      ctx.t.graphql
        .on("GetReviewAnswerContext", text())
        .on("CreateReviewAnswer", uniqueViolation);

      expect((await save("Twice")).status).toBe(409);
    });

    it("answers 400 for a list prompt", async () => {
      ctx.t.graphql.on("GetReviewAnswerContext", context());

      const res = await ctx.as(
        ctx.t
          .http()
          .put(answerPath())
          .send({ answer: { body: "One block" } }),
      );

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("CreateReviewAnswer")).toHaveLength(0);
    });

    it("answers 400 for a weekly prompt on a daily review", async () => {
      ctx.t.graphql.on(
        "GetReviewAnswerContext",
        context({ prompt: { kind: "weekly", style: "text" } }),
      );

      const res = await ctx.as(
        ctx.t
          .http()
          .put(answerPath(WEEKLY_PROMPT_ID))
          .send({ answer: { body: "Wrong kind" } }),
      );

      expect(res.status).toBe(400);
    });

    it.each([
      ["review", { review: null }],
      ["prompt", { prompt: null }],
    ])("answers 404 for someone else's %s", async (_, found) => {
      ctx.t.graphql.on("GetReviewAnswerContext", context(found));
      await ctx.signInAs(OTHER_USER);

      expect((await save("Not mine")).status).toBe(404);
      expect(ctx.t.graphql.calls("CreateReviewAnswer")).toHaveLength(0);
    });

    it.each([
      ["no body", undefined],
      ["a body that is not text", 42],
      ["a body over 10,000 characters", "x".repeat(10001)],
    ])("answers 400 for %s, before Hasura", async (_, body) => {
      expect((await save(body)).status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("CreateReviewAnswerItem", () => {
    const add = (body: unknown) =>
      ctx.as(
        ctx.t.http().post(`${answerPath()}/items`).send({ answer: { body } }),
      );

    it("adds an item at the end of the list, trimmed", async () => {
      ctx.t.graphql
        .on("GetReviewAnswerContext", context())
        .on("CreateReviewAnswer", {
          insert_minerva_review_answers_one: graphQlReviewAnswer({
            body: "Shipped the drawer",
            position: 3,
          }),
        });

      const res = await add("  Shipped the drawer ");

      expect(res.status).toBe(201);
      expect(res.headers.location).toBeUndefined();
      expect(res.body.answer.position).toBe(3);
      expect(ctx.t.graphql.calls("CreateReviewAnswer")[0].variables).toEqual({
        object: {
          reviewId: REVIEW_ID,
          promptId: REVIEW_PROMPT_ID,
          userId: USER,
          kind: "daily",
          body: "Shipped the drawer",
          position: 3,
        },
      });
    });

    it("starts an empty list at 0", async () => {
      ctx.t.graphql
        .on("GetReviewAnswerContext", context({ answers: [] }))
        .on("CreateReviewAnswer", {
          insert_minerva_review_answers_one: graphQlReviewAnswer(),
        });

      await add("First");

      expect(
        ctx.t.graphql.calls("CreateReviewAnswer")[0].variables,
      ).toMatchObject({ object: { position: 0 } });
    });

    it("answers 409 when another item took the place at the same time", async () => {
      ctx.t.graphql
        .on("GetReviewAnswerContext", context())
        .on("CreateReviewAnswer", uniqueViolation);

      expect((await add("Twice")).status).toBe(409);
    });

    it("answers 400 for a text prompt", async () => {
      ctx.t.graphql.on(
        "GetReviewAnswerContext",
        context({ prompt: { kind: "daily", style: "text" } }),
      );

      expect((await add("An item")).status).toBe(400);
      expect(ctx.t.graphql.calls("CreateReviewAnswer")).toHaveLength(0);
    });

    it("answers 404 for someone else's review", async () => {
      ctx.t.graphql.on("GetReviewAnswerContext", context({ review: null }));
      await ctx.signInAs(OTHER_USER);

      expect((await add("Not mine")).status).toBe(404);
    });

    it.each([
      ["no body", undefined],
      ["a blank body", "   "],
      ["a body over 200 characters", "x".repeat(201)],
    ])("answers 400 for %s, before Hasura", async (_, body) => {
      expect((await add(body)).status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("UpdateReviewAnswerItem", () => {
    const rewrite = (body: unknown, answerId = SECOND_ID) =>
      ctx.as(ctx.t.http().put(itemPath(answerId)).send({ answer: { body } }));

    it("rewrites an item", async () => {
      ctx.t.graphql
        .on("GetReviewAnswerContext", context())
        .on("UpdateReviewAnswerItem", {
          update_minerva_review_answers: {
            returning: [
              graphQlReviewAnswer({
                id: SECOND_ID,
                body: "Vendor call booked",
                position: 1,
              }),
            ],
          },
        });

      const res = await rewrite(" Vendor call booked ");

      expect(res.status).toBe(200);
      expect(res.body.answer.body).toBe("Vendor call booked");
      expect(
        ctx.t.graphql.calls("UpdateReviewAnswerItem")[0].variables,
      ).toEqual({
        userId: USER,
        answerId: SECOND_ID,
        body: "Vendor call booked",
      });
    });

    it("answers 404 for an item not in the prompt's list", async () => {
      ctx.t.graphql.on("GetReviewAnswerContext", context());

      const res = await rewrite(
        "Elsewhere",
        "9d5a3f00-0000-4000-8000-0000000000ff",
      );

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("UpdateReviewAnswerItem")).toHaveLength(0);
    });

    it("answers 400 for a blank body, before Hasura", async () => {
      expect((await rewrite("  ")).status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DeleteReviewAnswerItem", () => {
    const remove = (answerId = SECOND_ID) =>
      ctx.as(ctx.t.http().delete(itemPath(answerId)));

    it("removes an item", async () => {
      ctx.t.graphql
        .on("GetReviewAnswerContext", context())
        .on("DeleteReviewAnswerItem", {
          delete_minerva_review_answers: { affected_rows: 1 },
        });

      expect((await remove()).status).toBe(204);
      expect(
        ctx.t.graphql.calls("DeleteReviewAnswerItem")[0].variables,
      ).toEqual({ userId: USER, answerId: SECOND_ID });
    });

    it("answers 404 for someone else's item", async () => {
      ctx.t.graphql.on("GetReviewAnswerContext", context({ review: null }));
      await ctx.signInAs(OTHER_USER);

      expect((await remove()).status).toBe(404);
      expect(ctx.t.graphql.calls("DeleteReviewAnswerItem")).toHaveLength(0);
    });
  });

  describe("ReorderReviewAnswerItems", () => {
    const reorder = (answerIds: unknown) =>
      ctx.as(
        ctx.t.http().put(`${answerPath()}/items/order`).send({ answerIds }),
      );

    it("puts the items in the order given", async () => {
      ctx.t.graphql
        .on("GetReviewAnswerContext", context())
        .on("ReorderReviewAnswerItems", {
          update_minerva_review_answers_many: [
            { returning: [graphQlReviewAnswer({ id: THIRD_ID, position: 0 })] },
            { returning: [graphQlReviewAnswer({ position: 1 })] },
            {
              returning: [graphQlReviewAnswer({ id: SECOND_ID, position: 2 })],
            },
          ],
        });

      const res = await reorder([THIRD_ID, REVIEW_ANSWER_ID, SECOND_ID]);

      expect(res.status).toBe(200);
      expect(res.body.answers.map((a: { id: string }) => a.id)).toEqual([
        THIRD_ID,
        REVIEW_ANSWER_ID,
        SECOND_ID,
      ]);
      expect(
        ctx.t.graphql.calls("ReorderReviewAnswerItems")[0].variables,
      ).toEqual({
        updates: [THIRD_ID, REVIEW_ANSWER_ID, SECOND_ID].map(
          (id, position) => ({
            where: { id: { _eq: id }, userId: { _eq: USER } },
            _set: { position },
          }),
        ),
      });
    });

    it.each([
      ["one left out", [THIRD_ID, REVIEW_ANSWER_ID]],
      ["one twice", [THIRD_ID, REVIEW_ANSWER_ID, THIRD_ID]],
      [
        "one not in the list",
        [THIRD_ID, REVIEW_ANSWER_ID, "9d5a3f00-0000-4000-8000-0000000000ff"],
      ],
    ])("answers 400 for %s, reordering nothing", async (_, ids) => {
      ctx.t.graphql.on("GetReviewAnswerContext", context());

      expect((await reorder(ids)).status).toBe(400);
      expect(ctx.t.graphql.calls("ReorderReviewAnswerItems")).toHaveLength(0);
    });

    it("answers 400 for IDs that are no list, before Hasura", async () => {
      expect((await reorder("all")).status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("CreateReviewAnswerTodo", () => {
    const todo = (answerId = SECOND_ID) =>
      ctx.as(ctx.t.http().post(`${itemPath(answerId)}/todo`));
    /** What CreateReviewItem needs: the review, and tomorrow's to-dos. */
    const planning = () =>
      ctx.t.graphql
        .on("GetReviewItemReview", {
          minerva_reviews: [{ kind: "daily", periodStart: "2026-09-30" }],
        })
        .on("GetReviewItemLastPosition", {
          minerva_review_items_aggregate: {
            aggregate: { max: { position: 1 } },
          },
        });

    it("plans the item as tomorrow's last to-do and links them", async () => {
      ctx.t.graphql.on("GetReviewAnswerContext", context());
      planning()
        .on("CreateReviewItem", {
          insert_minerva_review_items_one: graphQlReviewItem({
            kind: "todo",
            title: "Vendor call",
            periodStart: "2026-10-01",
            position: 2,
          }),
        })
        .on("LinkReviewAnswerTodo", {
          update_minerva_review_answers: {
            returning: [
              graphQlReviewAnswer({
                id: SECOND_ID,
                body: "Vendor call",
                position: 1,
                reviewItemId: REVIEW_ITEM_ID,
              }),
            ],
          },
        });

      const res = await todo();

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(
        `/v1/minerva/reviews/item/${REVIEW_ITEM_ID}`,
      );
      expect(res.body.answer.reviewItemId).toBe(REVIEW_ITEM_ID);
      expect(res.body.reviewItem).toMatchObject({
        kind: "todo",
        title: "Vendor call",
      });
      expect(
        ctx.t.graphql.calls("CreateReviewItem")[0].variables,
      ).toMatchObject({
        object: {
          userId: USER,
          reviewId: REVIEW_ID,
          scope: "day",
          periodStart: "2026-10-01",
          kind: "todo",
          title: "Vendor call",
          position: 2,
        },
      });
      expect(ctx.t.graphql.calls("LinkReviewAnswerTodo")[0].variables).toEqual({
        userId: USER,
        answerId: SECOND_ID,
        reviewItemId: REVIEW_ITEM_ID,
      });
    });

    it("answers 409 for an item that is already a to-do, planning nothing", async () => {
      ctx.t.graphql.on(
        "GetReviewAnswerContext",
        context({
          answers: [
            graphQlReviewAnswer({
              id: SECOND_ID,
              reviewItemId: REVIEW_ITEM_ID,
            }),
          ],
        }),
      );

      expect((await todo()).status).toBe(409);
      expect(ctx.t.graphql.calls("CreateReviewItem")).toHaveLength(0);
    });

    it("takes its to-do away again when another got there first", async () => {
      ctx.t.graphql.on("GetReviewAnswerContext", context());
      planning()
        .on("CreateReviewItem", {
          insert_minerva_review_items_one: graphQlReviewItem({ kind: "todo" }),
        })
        .on("LinkReviewAnswerTodo", {
          update_minerva_review_answers: { returning: [] },
        })
        .on("DescribeReviewItem", {
          minerva_review_items: [graphQlReviewItem({ kind: "todo" })],
        })
        .on("DeleteReviewItem", {
          delete_minerva_review_items: { affected_rows: 1 },
        });

      expect((await todo()).status).toBe(409);
      expect(
        ctx.t.graphql.calls("DeleteReviewItem")[0].variables,
      ).toMatchObject({ userId: USER, itemId: REVIEW_ITEM_ID, reopen: false });
    });

    it("answers 404 for an item not in the prompt's list", async () => {
      ctx.t.graphql.on("GetReviewAnswerContext", context());

      expect((await todo("9d5a3f00-0000-4000-8000-0000000000ff")).status).toBe(
        404,
      );
      expect(ctx.t.graphql.calls("CreateReviewItem")).toHaveLength(0);
    });
  });
});
