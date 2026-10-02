import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  graphQlReview,
  REVIEW_ID,
  REVIEW_PROMPT_ID,
} from "../../fixtures/minerva";
import {
  OTHER_USER,
  signedInApp,
  uniqueViolation,
  USER,
} from "../../support/signedInApp";

const BASE = "/v1/minerva";
const PACIFIC = "America/Los_Angeles";
const WEEKLY_ID = "7b3e1d00-0000-4000-8000-000000000002";

const weekly = () =>
  graphQlReview({
    id: WEEKLY_ID,
    kind: "weekly",
    periodStart: "2026-09-28",
    step: 1,
    overall: null,
    mood: null,
    energy: null,
    focus: null,
    answers: [],
  });

/**
 * The review operations over the real HTTP stack, at 23:30 on Thursday
 * 2026-10-01 in Seattle (06:30 on the 2nd in UTC) unless a test says
 * otherwise.
 */
describe("Reviews API", () => {
  const ctx = signedInApp();

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:30:00Z"));
    // Signed again at the pinned time, so the token is current there.
    await ctx.signInAs(USER);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("without an identity", () => {
    it.each([
      ["get", `${BASE}/reviews?kind=daily&from=2026-09-28&to=2026-10-04`],
      ["post", `${BASE}/reviews`],
      ["get", `${BASE}/review/${REVIEW_ID}`],
      ["put", `${BASE}/review/${REVIEW_ID}`],
      ["post", `${BASE}/review/${REVIEW_ID}/complete`],
      ["delete", `${BASE}/review/${REVIEW_ID}`],
      ["put", `${BASE}/review/${REVIEW_ID}/answer/${REVIEW_PROMPT_ID}`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await ctx.t.http()[method](path);
        expect(res.status).toBe(401);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("ListReviews", () => {
    it("lists the caller's reviews of a kind in the range", async () => {
      ctx.t.graphql.on("ListReviews", {
        minerva_reviews: [graphQlReview()],
      });

      const res = await ctx.as(
        ctx.t
          .http()
          .get(`${BASE}/reviews?kind=daily&from=2026-09-28&to=2026-10-04`),
      );

      expect(res.status).toBe(200);
      expect(res.body.reviews).toHaveLength(1);
      expect(res.body.reviews[0]).toMatchObject({
        id: REVIEW_ID,
        kind: "daily",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-01",
        overall: 4,
        completed: false,
        answers: [{ promptId: REVIEW_PROMPT_ID, editedLater: false }],
      });
      expect(ctx.t.graphql.calls("ListReviews")[0].variables).toEqual({
        userId: USER,
        kind: "daily",
        from: "2026-09-28",
        to: "2026-10-04",
      });
    });

    it.each([
      ["no kind", "from=2026-09-28&to=2026-10-04"],
      ["a monthly kind", "kind=monthly&from=2026-09-28&to=2026-10-04"],
      ["no from", "kind=daily&to=2026-10-04"],
      ["a from that is no date", "kind=daily&from=2026-09-31&to=2026-10-04"],
      ["a to before from", "kind=daily&from=2026-10-04&to=2026-09-28"],
      ["a range over 400 days", "kind=weekly&from=2025-01-01&to=2026-10-04"],
    ])("answers 400 for %s, before Hasura", async (_, query) => {
      const res = await ctx.as(ctx.t.http().get(`${BASE}/reviews?${query}`));
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("CreateReview", () => {
    const create = (review: unknown, tz = PACIFIC) =>
      ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/reviews`)
          .set("x-ncfritz-tz", tz)
          .send({ review }),
      );

    it("starts today's daily review, with a Location header", async () => {
      ctx.t.graphql.on("CreateReview", {
        insert_minerva_reviews_one: graphQlReview({
          step: 1,
          overall: null,
          mood: null,
          energy: null,
          focus: null,
          answers: [],
        }),
      });

      const res = await create({ kind: "daily", period: "2026-10-01" });

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/v1/minerva/review/${REVIEW_ID}`);
      expect(res.body.review).toMatchObject({ step: 1, completed: false });
      expect(ctx.t.graphql.calls("CreateReview")[0].variables).toEqual({
        object: { userId: USER, kind: "daily", periodStart: "2026-10-01" },
      });
    });

    it.each([["2026-W40"], ["2026-09-28"]])(
      "starts a weekly review from %s at its Monday",
      async (period) => {
        ctx.t.graphql.on("CreateReview", {
          insert_minerva_reviews_one: weekly(),
        });

        const res = await create({ kind: "weekly", period });

        expect(res.status).toBe(201);
        expect(res.body.review.periodEnd).toBe("2026-10-04");
        expect(ctx.t.graphql.calls("CreateReview")[0].variables).toEqual({
          object: { userId: USER, kind: "weekly", periodStart: "2026-09-28" },
        });
      },
    );

    it("takes today from the caller's timezone", async () => {
      ctx.t.graphql.on("CreateReview", {
        insert_minerva_reviews_one: graphQlReview({
          periodStart: "2026-10-02",
        }),
      });

      expect(
        (await create({ kind: "daily", period: "2026-10-02" })).status,
      ).toBe(400);
      expect(
        (await create({ kind: "daily", period: "2026-10-02" }, "Etc/UTC"))
          .status,
      ).toBe(201);
    });

    it("answers 409 for a period the caller already reviewed", async () => {
      ctx.t.graphql.on("CreateReview", uniqueViolation);

      const res = await create({ kind: "daily", period: "2026-10-01" });

      expect(res.status).toBe(409);
    });

    it.each([
      ["no review", undefined],
      ["no kind", { period: "2026-10-01" }],
      ["a monthly review", { kind: "monthly", period: "2026-10-01" }],
      ["a daily review of a week", { kind: "daily", period: "2026-W40" }],
      ["a week from a Tuesday", { kind: "weekly", period: "2026-09-29" }],
      ["week 53 of a short year", { kind: "weekly", period: "2027-W53" }],
      ["tomorrow", { kind: "daily", period: "2026-10-02" }],
      ["next week", { kind: "weekly", period: "2026-W41" }],
    ])("answers 400 for %s, before Hasura", async (_, review) => {
      const res = await create(review);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it("answers 400 for a timezone it does not know", async () => {
      const res = await create(
        { kind: "daily", period: "2026-10-01" },
        "Mars/Base",
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DescribeReview", () => {
    it("describes one of the caller's reviews", async () => {
      ctx.t.graphql.on("DescribeReview", {
        minerva_reviews: [graphQlReview()],
      });

      const res = await ctx.as(ctx.t.http().get(`${BASE}/review/${REVIEW_ID}`));

      expect(res.status).toBe(200);
      expect(res.body.review.id).toBe(REVIEW_ID);
      expect(ctx.t.graphql.calls("DescribeReview")[0].variables).toEqual({
        userId: USER,
        reviewId: REVIEW_ID,
      });
    });

    it("answers 404 for someone else's review", async () => {
      ctx.t.graphql.on("DescribeReview", { minerva_reviews: [] });
      await ctx.signInAs(OTHER_USER);

      const res = await ctx.as(ctx.t.http().get(`${BASE}/review/${REVIEW_ID}`));

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("DescribeReview")[0].variables).toMatchObject({
        userId: OTHER_USER,
      });
    });

    it("answers 400 for an id that is not a UUID, before Hasura", async () => {
      const res = await ctx.as(ctx.t.http().get(`${BASE}/review/nope`));
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("UpdateReview", () => {
    const update = (review: unknown, id = REVIEW_ID) =>
      ctx.as(ctx.t.http().put(`${BASE}/review/${id}`).send({ review }));

    it("sets the step and the day's ratings, sending only what changed", async () => {
      ctx.t.graphql
        .on("DescribeReview", { minerva_reviews: [graphQlReview()] })
        .on("UpdateReview", {
          update_minerva_reviews: {
            returning: [graphQlReview({ step: 3, focus: 3, energy: null })],
          },
        });

      const res = await update({ step: 3, overall: 4, focus: 3, energy: null });

      expect(res.status).toBe(200);
      expect(res.body.review).toMatchObject({ step: 3, focus: 3 });
      expect(res.body.review.energy).toBeUndefined();
      expect(ctx.t.graphql.calls("UpdateReview")[0].variables).toEqual({
        userId: USER,
        reviewId: REVIEW_ID,
        set: { step: 3, focus: 3, energy: null },
      });
    });

    it("answers 304 for a body that names nothing", async () => {
      ctx.t.graphql.on("DescribeReview", {
        minerva_reviews: [graphQlReview()],
      });

      const res = await update({});

      expect(res.status).toBe(304);
      expect(ctx.t.graphql.calls("UpdateReview")).toHaveLength(0);
    });

    it("returns the review unchanged when nothing differs", async () => {
      ctx.t.graphql.on("DescribeReview", {
        minerva_reviews: [graphQlReview()],
      });

      const res = await update({ step: 2, overall: 4 });

      expect(res.status).toBe(200);
      expect(ctx.t.graphql.calls("UpdateReview")).toHaveLength(0);
    });

    it("answers 409 for a rating changed on a completed review", async () => {
      ctx.t.graphql.on("DescribeReview", {
        minerva_reviews: [
          graphQlReview({ completedTime: "2026-10-01T22:00:00Z" }),
        ],
      });

      const res = await update({ overall: 5 });

      expect(res.status).toBe(409);
      expect(ctx.t.graphql.calls("UpdateReview")).toHaveLength(0);
    });

    it("still moves a completed review's step", async () => {
      const done = { completedTime: "2026-10-01T22:00:00Z" };
      ctx.t.graphql
        .on("DescribeReview", { minerva_reviews: [graphQlReview(done)] })
        .on("UpdateReview", {
          update_minerva_reviews: {
            returning: [graphQlReview({ ...done, step: 4 })],
          },
        });

      const res = await update({ step: 4, overall: 4 });

      expect(res.status).toBe(200);
      expect(ctx.t.graphql.calls("UpdateReview")[0].variables).toMatchObject({
        set: { step: 4 },
      });
    });

    it.each([
      ["progress on a day", { progress: 3 }, REVIEW_ID],
      ["step 5 on a day", { step: 5 }, REVIEW_ID],
      ["mood on a week", { mood: 3 }, WEEKLY_ID],
    ])("answers 400 for %s", async (_, review, id) => {
      ctx.t.graphql.on("DescribeReview", (variables) => ({
        minerva_reviews: [
          variables?.reviewId === WEEKLY_ID ? weekly() : graphQlReview(),
        ],
      }));

      const res = await update(review, id);

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("UpdateReview")).toHaveLength(0);
    });

    it.each([
      ["no review", undefined],
      ["a rating of 6", { overall: 6 }],
      ["a rating of 2.5", { focus: 2.5 }],
      ["a rating as text", { mood: "4" }],
      ["step 0", { step: 0 }],
      ["step 6", { step: 6 }],
    ])("answers 400 for %s, before Hasura", async (_, review) => {
      const res = await update(review);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it("answers 404 for someone else's review, writing nothing", async () => {
      ctx.t.graphql.on("DescribeReview", { minerva_reviews: [] });
      await ctx.signInAs(OTHER_USER);

      const res = await update({ overall: 5 });

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("UpdateReview")).toHaveLength(0);
    });
  });

  describe("CompleteReview", () => {
    const complete = () =>
      ctx.as(ctx.t.http().post(`${BASE}/review/${REVIEW_ID}/complete`));

    it("records when the review was completed", async () => {
      ctx.t.graphql.on("CompleteReview", {
        update_minerva_reviews: {
          returning: [graphQlReview({ completedTime: "2026-10-02T06:30:00Z" })],
        },
      });

      const res = await complete();

      expect(res.status).toBe(200);
      expect(res.body.review.completed).toBe(true);
      expect(ctx.t.graphql.calls("CompleteReview")[0].variables).toEqual({
        userId: USER,
        reviewId: REVIEW_ID,
        now: "2026-10-02T06:30:00.000Z",
      });
    });

    it("answers 304 when it was already completed", async () => {
      ctx.t.graphql
        .on("CompleteReview", { update_minerva_reviews: { returning: [] } })
        .on("DescribeReview", {
          minerva_reviews: [
            graphQlReview({ completedTime: "2026-10-01T22:00:00Z" }),
          ],
        });

      expect((await complete()).status).toBe(304);
    });

    it("answers 404 for someone else's review", async () => {
      ctx.t.graphql
        .on("CompleteReview", { update_minerva_reviews: { returning: [] } })
        .on("DescribeReview", { minerva_reviews: [] });
      await ctx.signInAs(OTHER_USER);

      expect((await complete()).status).toBe(404);
    });
  });

  describe("DeleteReview", () => {
    it("deletes one of the caller's reviews", async () => {
      ctx.t.graphql.on("DeleteReview", {
        delete_minerva_reviews: { affected_rows: 1 },
      });

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/review/${REVIEW_ID}`),
      );

      expect(res.status).toBe(204);
      expect(ctx.t.graphql.calls("DeleteReview")[0].variables).toEqual({
        userId: USER,
        reviewId: REVIEW_ID,
      });
    });

    it("answers 404 for someone else's review", async () => {
      ctx.t.graphql.on("DeleteReview", {
        delete_minerva_reviews: { affected_rows: 0 },
      });
      await ctx.signInAs(OTHER_USER);

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/review/${REVIEW_ID}`),
      );

      expect(res.status).toBe(404);
    });
  });
});
