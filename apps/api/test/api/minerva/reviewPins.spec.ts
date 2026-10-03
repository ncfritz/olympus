import { describe, expect, it } from "vitest";
import {
  OTHER_USER,
  signedInApp,
  uniqueViolation,
  USER,
} from "../../support/signedInApp";

const BASE = "/v1/minerva";
const WEEK_ID = "7b3e1d00-0000-4000-8000-000000000002";
const PIN_ID = "b0b0b0b0-0000-4000-8000-000000000001";
const ANSWER_ID = "9d5a3f00-0000-4000-8000-000000000001";
const NOTE_ID = "c0ffee00-0000-4000-8000-000000000001";

const week40 = { kind: "weekly", periodStart: "2026-09-28" };

const pinRow = (overrides = {}) => ({
  id: PIN_ID,
  reviewId: WEEK_ID,
  answerId: ANSWER_ID,
  noteId: null,
  createdTime: "2026-10-04T18:00:00Z",
  lastUpdatedTime: "2026-10-04T18:00:00Z",
  ...overrides,
});

/**
 * The pin operations over the real HTTP stack: what week 40's review keeps
 * from its week.
 */
describe("Review pins API", () => {
  const ctx = signedInApp();

  const context = ({
    review = week40 as { kind: string; periodStart: string } | null,
    answerReview = { kind: "daily", periodStart: "2026-09-30" } as {
      kind: string;
      periodStart: string;
    } | null,
    note = true,
  } = {}) =>
    ctx.t.graphql.on("GetReviewPinContext", (variables) => ({
      minerva_reviews: review ? [review] : [],
      ...(variables?.isAnswer
        ? {
            minerva_review_answers: answerReview
              ? [{ review: answerReview }]
              : [],
          }
        : { minerva_notes: note ? [{ id: NOTE_ID }] : [] }),
    }));
  const pin = (reviewPin: unknown) =>
    ctx.as(
      ctx.t.http().post(`${BASE}/review/${WEEK_ID}/pins`).send({ reviewPin }),
    );

  describe("without an identity", () => {
    it.each([
      ["get", `${BASE}/review/${WEEK_ID}/pins`],
      ["post", `${BASE}/review/${WEEK_ID}/pins`],
      ["delete", `${BASE}/review/${WEEK_ID}/pin/${PIN_ID}`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await ctx.t.http()[method](path);
        expect(res.status).toBe(401);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("ListReviewPins", () => {
    it("lists a review's pins", async () => {
      ctx.t.graphql.on("ListReviewPins", {
        minerva_reviews: [{ id: WEEK_ID }],
        minerva_review_pins: [
          pinRow(),
          pinRow({
            id: "b0b0b0b0-0000-4000-8000-000000000002",
            answerId: null,
            noteId: NOTE_ID,
          }),
        ],
      });

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/review/${WEEK_ID}/pins`),
      );

      expect(res.status).toBe(200);
      expect(
        res.body.reviewPins.map(
          (p: { answerId?: string; noteId?: string }) => p.answerId ?? p.noteId,
        ),
      ).toEqual([ANSWER_ID, NOTE_ID]);
      expect(ctx.t.graphql.calls("ListReviewPins")[0].variables).toEqual({
        userId: USER,
        reviewId: WEEK_ID,
      });
    });

    it("answers 404 for someone else's review", async () => {
      ctx.t.graphql.on("ListReviewPins", {
        minerva_reviews: [],
        minerva_review_pins: [],
      });
      await ctx.signInAs(OTHER_USER);

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/review/${WEEK_ID}/pins`),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("CreateReviewPin", () => {
    it("pins Wednesday's answer to week 40", async () => {
      context().on("CreateReviewPin", {
        insert_minerva_review_pins_one: pinRow(),
      });

      const res = await pin({ answerId: ANSWER_ID });

      expect(res.status).toBe(201);
      expect(res.headers.location).toBeUndefined();
      expect(res.body.reviewPin.answerId).toBe(ANSWER_ID);
      expect(ctx.t.graphql.calls("GetReviewPinContext")[0].variables).toEqual({
        userId: USER,
        reviewId: WEEK_ID,
        targetId: ANSWER_ID,
        isAnswer: true,
      });
      expect(ctx.t.graphql.calls("CreateReviewPin")[0].variables).toEqual({
        object: { userId: USER, reviewId: WEEK_ID, answerId: ANSWER_ID },
      });
    });

    it.each([["2026-09-28"], ["2026-10-04"]])(
      "pins an answer from %s, the week's first or last day",
      async (periodStart) => {
        context({ answerReview: { kind: "daily", periodStart } }).on(
          "CreateReviewPin",
          { insert_minerva_review_pins_one: pinRow() },
        );

        expect((await pin({ answerId: ANSWER_ID })).status).toBe(201);
      },
    );

    it("pins a note", async () => {
      context().on("CreateReviewPin", {
        insert_minerva_review_pins_one: pinRow({
          answerId: null,
          noteId: NOTE_ID,
        }),
      });

      const res = await pin({ noteId: NOTE_ID });

      expect(res.status).toBe(201);
      expect(ctx.t.graphql.calls("CreateReviewPin")[0].variables).toEqual({
        object: { userId: USER, reviewId: WEEK_ID, noteId: NOTE_ID },
      });
    });

    it.each([
      [
        "an answer from the week before",
        { answerReview: { kind: "daily", periodStart: "2026-09-27" } },
      ],
      [
        "an answer from the week after",
        { answerReview: { kind: "daily", periodStart: "2026-10-05" } },
      ],
      [
        "an answer from a weekly review",
        { answerReview: { kind: "weekly", periodStart: "2026-09-28" } },
      ],
      [
        "a pin on a daily review",
        { review: { kind: "daily", periodStart: "2026-09-30" } },
      ],
    ])("answers 400 for %s, pinning nothing", async (_, found) => {
      context(found);

      const res = await pin({ answerId: ANSWER_ID });

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("CreateReviewPin")).toHaveLength(0);
    });

    it.each([
      ["review", { review: null }, { answerId: ANSWER_ID }],
      ["answer", { answerReview: null }, { answerId: ANSWER_ID }],
      ["note", { note: false }, { noteId: NOTE_ID }],
    ])("answers 404 for a %s that is not there", async (_, found, body) => {
      context(found);

      const res = await pin(body);

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("CreateReviewPin")).toHaveLength(0);
    });

    it("answers 409 for something already pinned", async () => {
      context().on("CreateReviewPin", uniqueViolation);

      expect((await pin({ noteId: NOTE_ID })).status).toBe(409);
    });

    it.each([
      ["no pin", undefined],
      ["neither", {}],
      ["both", { answerId: ANSWER_ID, noteId: NOTE_ID }],
      ["an answer ID that is no ID", { answerId: "wednesday" }],
    ])("answers 400 for %s, before Hasura", async (_, reviewPin) => {
      const res = await pin(reviewPin);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DeleteReviewPin", () => {
    const unpin = () =>
      ctx.as(ctx.t.http().delete(`${BASE}/review/${WEEK_ID}/pin/${PIN_ID}`));

    it("unpins", async () => {
      ctx.t.graphql.on("DeleteReviewPin", {
        delete_minerva_review_pins: { affected_rows: 1 },
      });

      expect((await unpin()).status).toBe(204);
      expect(ctx.t.graphql.calls("DeleteReviewPin")[0].variables).toEqual({
        userId: USER,
        reviewId: WEEK_ID,
        pinId: PIN_ID,
      });
    });

    it("answers 404 for someone else's pin", async () => {
      ctx.t.graphql.on("DeleteReviewPin", {
        delete_minerva_review_pins: { affected_rows: 0 },
      });
      await ctx.signInAs(OTHER_USER);

      expect((await unpin()).status).toBe(404);
    });
  });
});
