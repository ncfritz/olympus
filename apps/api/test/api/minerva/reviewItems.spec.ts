import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  graphQlReviewItem,
  REVIEW_ID,
  REVIEW_ITEM_ID,
} from "../../fixtures/minerva";
import {
  OTHER_USER,
  signedInApp,
  uniqueViolation,
  USER,
} from "../../support/signedInApp";

const BASE = "/v1/minerva";
const FRIDAY_REVIEW_ID = "7b3e1d00-0000-4000-8000-000000000003";
const WEEKLY_ID = "7b3e1d00-0000-4000-8000-000000000002";
const COPY_ID = "a1b2c3d4-0000-4000-8000-000000000004";
const SECOND_ID = "a1b2c3d4-0000-4000-8000-000000000002";
const NOW = "2026-10-02T18:00:00.000Z";

/** Each review the tests plan or carry from, by ID. */
const REVIEWS: Record<string, { kind: string; periodStart: string }> = {
  [REVIEW_ID]: { kind: "daily", periodStart: "2026-10-01" },
  [FRIDAY_REVIEW_ID]: { kind: "daily", periodStart: "2026-10-02" },
  [WEEKLY_ID]: { kind: "weekly", periodStart: "2026-09-28" },
};

/** Next week's priority from the week 40 review, Monday 2026-10-05. */
const weekItem = (overrides = {}) =>
  graphQlReviewItem({
    reviewId: WEEKLY_ID,
    scope: "week",
    periodStart: "2026-10-05",
    title: "Finalize Q4 OKRs and share",
    ...overrides,
  });

/**
 * The review item operations over the real HTTP stack, at 11:00 on Friday
 * 2026-10-02 in Seattle unless a test says otherwise.
 */
describe("Review items API", () => {
  const ctx = signedInApp();

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    // Signed again at the pinned time, so the token is current there.
    await ctx.signInAs(USER);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The reviews the caller has, looked up by ID; none for another user. */
  const reviews = () =>
    ctx.t.graphql.on("GetReviewItemReview", (variables) => ({
      minerva_reviews:
        variables?.userId === USER && REVIEWS[variables.reviewId as string]
          ? [REVIEWS[variables.reviewId as string]]
          : [],
    }));
  const lastPosition = (position: number | null) =>
    ctx.t.graphql.on("GetReviewItemLastPosition", {
      minerva_review_items_aggregate: { aggregate: { max: { position } } },
    });
  const described = (row = graphQlReviewItem()) =>
    ctx.t.graphql.on("DescribeReviewItem", { minerva_review_items: [row] });

  describe("without an identity", () => {
    it.each([
      ["get", `${BASE}/reviews/items?scope=day&from=2026-10-02&to=2026-10-02`],
      ["post", `${BASE}/review/${REVIEW_ID}/items`],
      ["put", `${BASE}/reviews/items/order`],
      ["get", `${BASE}/reviews/item/${REVIEW_ITEM_ID}`],
      ["put", `${BASE}/reviews/item/${REVIEW_ITEM_ID}`],
      ["post", `${BASE}/reviews/item/${REVIEW_ITEM_ID}/carry`],
      ["delete", `${BASE}/reviews/item/${REVIEW_ITEM_ID}`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await ctx.t.http()[method](path);
        expect(res.status).toBe(401);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("ListReviewItems", () => {
    it("lists the caller's items of a scope in the range", async () => {
      ctx.t.graphql.on("ListReviewItems", {
        minerva_review_items: [
          graphQlReviewItem(),
          graphQlReviewItem({
            id: SECOND_ID,
            kind: "todo",
            title: "Book dentist",
          }),
        ],
      });

      const res = await ctx.as(
        ctx.t
          .http()
          .get(`${BASE}/reviews/items?scope=day&from=2026-10-02&to=2026-10-02`),
      );

      expect(res.status).toBe(200);
      expect(res.body.reviewItems.map((i: { kind: string }) => i.kind)).toEqual(
        ["priority", "todo"],
      );
      expect(ctx.t.graphql.calls("ListReviewItems")[0].variables).toEqual({
        userId: USER,
        scope: "day",
        from: "2026-10-02",
        to: "2026-10-02",
      });
    });

    it.each([
      ["no scope", "from=2026-10-02&to=2026-10-02"],
      ["a month scope", "scope=month&from=2026-10-02&to=2026-10-02"],
      ["no to", "scope=day&from=2026-10-02"],
      ["a to before from", "scope=day&from=2026-10-02&to=2026-10-01"],
      ["a range over 400 days", "scope=week&from=2025-01-06&to=2026-10-05"],
    ])("answers 400 for %s, before Hasura", async (_, query) => {
      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/reviews/items?${query}`),
      );
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("CreateReviewItem", () => {
    const create = (reviewItem: unknown, reviewId = REVIEW_ID) =>
      ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/review/${reviewId}/items`)
          .send({ reviewItem }),
      );

    it("plans tomorrow from a daily review, after the last of its kind", async () => {
      reviews();
      lastPosition(1).on("CreateReviewItem", {
        insert_minerva_review_items_one: graphQlReviewItem({ position: 2 }),
      });

      const res = await create({ kind: "priority", title: "  Draft Q4 OKRs " });

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(
        `/v1/minerva/reviews/item/${REVIEW_ITEM_ID}`,
      );
      expect(ctx.t.graphql.calls("CreateReviewItem")[0].variables).toEqual({
        object: {
          userId: USER,
          reviewId: REVIEW_ID,
          scope: "day",
          periodStart: "2026-10-02",
          kind: "priority",
          title: "Draft Q4 OKRs",
          position: 2,
        },
      });
      expect(
        ctx.t.graphql.calls("GetReviewItemLastPosition")[0].variables,
      ).toEqual({
        userId: USER,
        scope: "day",
        periodStart: "2026-10-02",
        kind: "priority",
      });
    });

    it("plans next week from a weekly review, first of its kind at 0", async () => {
      reviews();
      lastPosition(null).on("CreateReviewItem", {
        insert_minerva_review_items_one: weekItem(),
      });

      const res = await create(
        { kind: "priority", title: "Finalize Q4 OKRs and share" },
        WEEKLY_ID,
      );

      expect(res.status).toBe(201);
      expect(
        ctx.t.graphql.calls("CreateReviewItem")[0].variables,
      ).toMatchObject({
        object: { scope: "week", periodStart: "2026-10-05", position: 0 },
      });
    });

    it("answers 404 for someone else's review, planning nothing", async () => {
      reviews();
      await ctx.signInAs(OTHER_USER);

      const res = await create({ kind: "todo", title: "Not mine" });

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("CreateReviewItem")).toHaveLength(0);
    });

    it("answers 409 when another item took the place meanwhile", async () => {
      reviews();
      lastPosition(0).on("CreateReviewItem", uniqueViolation);

      const res = await create({ kind: "todo", title: "Book dentist" });

      expect(res.status).toBe(409);
    });

    it.each([
      ["no item", undefined],
      ["no kind", { title: "Hm" }],
      ["a goal kind", { kind: "goal", title: "Hm" }],
      ["a blank title", { kind: "todo", title: "  " }],
      ["a 201-character title", { kind: "todo", title: "x".repeat(201) }],
    ])("answers 400 for %s, before Hasura", async (_, reviewItem) => {
      const res = await create(reviewItem);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DescribeReviewItem", () => {
    it("describes one of the caller's items", async () => {
      described();

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/reviews/item/${REVIEW_ITEM_ID}`),
      );

      expect(res.status).toBe(200);
      expect(res.body.reviewItem.title).toBe("Draft Q4 OKRs");
    });

    it("answers 404 for someone else's item", async () => {
      ctx.t.graphql.on("DescribeReviewItem", { minerva_review_items: [] });
      await ctx.signInAs(OTHER_USER);

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/reviews/item/${REVIEW_ITEM_ID}`),
      );

      expect(res.status).toBe(404);
      expect(
        ctx.t.graphql.calls("DescribeReviewItem")[0].variables,
      ).toMatchObject({ userId: OTHER_USER });
    });
  });

  describe("UpdateReviewItem", () => {
    const update = (reviewItem: unknown) =>
      ctx.as(
        ctx.t
          .http()
          .put(`${BASE}/reviews/item/${REVIEW_ITEM_ID}`)
          .send({ reviewItem }),
      );
    const updated = (row = graphQlReviewItem()) =>
      ctx.t.graphql.on("UpdateReviewItem", {
        update_minerva_review_items: { returning: [row] },
      });
    const sent = () =>
      (
        ctx.t.graphql.calls("UpdateReviewItem")[0].variables as {
          set: Record<string, unknown>;
        }
      ).set;

    it("marks an item done, recording when", async () => {
      described();
      updated(graphQlReviewItem({ status: "done", doneTime: NOW }));

      const res = await update({ status: "done" });

      expect(res.status).toBe(200);
      expect(res.body.reviewItem.status).toBe("done");
      expect(sent()).toEqual({ status: "done", doneTime: NOW });
    });

    it.each([["open"], ["someday"], ["dropped"]])(
      "sets a done item %s, clearing when it was done",
      async (status) => {
        described(graphQlReviewItem({ status: "done", doneTime: NOW }));
        updated();

        await update({ status });

        expect(sent()).toEqual({ status, doneTime: null });
      },
    );

    it("retitles an item, trimmed", async () => {
      described();
      updated();

      await update({ title: " Draft and share Q4 OKRs " });

      expect(sent()).toEqual({ title: "Draft and share Q4 OKRs" });
    });

    it("blocks time on a day item's day", async () => {
      described();
      updated();

      await update({
        scheduledOn: "2026-10-02",
        scheduledStart: "09:00",
        scheduledEnd: "11:00",
      });

      expect(sent()).toEqual({
        scheduledOn: "2026-10-02",
        scheduledStart: "09:00",
        scheduledEnd: "11:00",
      });
    });

    it("places a week's priority on Wednesday 9:00 to 11:00", async () => {
      described(weekItem());
      updated(weekItem());

      const res = await update({
        scheduledOn: "2026-10-07",
        scheduledStart: "09:00",
        scheduledEnd: "11:00",
      });

      expect(res.status).toBe(200);
      expect(sent()).toMatchObject({ scheduledOn: "2026-10-07" });
    });

    it("clears the block with the day", async () => {
      described(
        weekItem({
          scheduledOn: "2026-10-07",
          scheduledStart: "09:00:00",
          scheduledEnd: "11:00:00",
        }),
      );
      updated(weekItem());

      await update({ scheduledOn: null });

      expect(sent()).toEqual({
        scheduledOn: null,
        scheduledStart: null,
        scheduledEnd: null,
      });
    });

    it("answers 409 for a carried item's status, writing nothing", async () => {
      described(graphQlReviewItem({ status: "carried" }));

      const res = await update({ status: "done" });

      expect(res.status).toBe(409);
      expect(ctx.t.graphql.calls("UpdateReviewItem")).toHaveLength(0);
    });

    it.each([
      ["a day item on another day", { scheduledOn: "2026-10-03" }, false],
      ["a week item outside its week", { scheduledOn: "2026-10-12" }, true],
      [
        "an end before the start",
        {
          scheduledOn: "2026-10-02",
          scheduledStart: "11:00",
          scheduledEnd: "09:00",
        },
        false,
      ],
      [
        "a block with one end",
        { scheduledOn: "2026-10-02", scheduledStart: "09:00" },
        false,
      ],
      [
        "a block on no day",
        { scheduledStart: "09:00", scheduledEnd: "10:00" },
        false,
      ],
    ])("answers 400 for %s, writing nothing", async (_, reviewItem, week) => {
      described(week ? weekItem() : graphQlReviewItem());

      const res = await update(reviewItem);

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("UpdateReviewItem")).toHaveLength(0);
    });

    it.each([
      ["no item", undefined],
      ["the carried status", { status: "carried" }],
      ["a status not in the list", { status: "blocked" }],
      ["a blank title", { title: "" }],
      ["a time that is no time", { scheduledStart: "9am" }],
      ["a time past midnight", { scheduledEnd: "24:00" }],
      ["a day that is no date", { scheduledOn: "Wednesday" }],
    ])("answers 400 for %s, before Hasura", async (_, reviewItem) => {
      const res = await update(reviewItem);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it("answers 304 for a body that names nothing", async () => {
      described();
      expect((await update({})).status).toBe(304);
    });

    it("answers 404 for someone else's item", async () => {
      ctx.t.graphql.on("DescribeReviewItem", { minerva_review_items: [] });
      await ctx.signInAs(OTHER_USER);

      expect((await update({ status: "done" })).status).toBe(404);
      expect(ctx.t.graphql.calls("UpdateReviewItem")).toHaveLength(0);
    });
  });

  describe("ReorderReviewItems", () => {
    const reorder = (body: object) =>
      ctx.as(ctx.t.http().put(`${BASE}/reviews/items/order`).send(body));
    const inPeriod = () =>
      ctx.t.graphql.on("ListReviewItems", {
        minerva_review_items: [
          graphQlReviewItem(),
          graphQlReviewItem({ id: SECOND_ID, position: 1 }),
          graphQlReviewItem({ id: COPY_ID, kind: "todo" }),
        ],
      });

    it("reorders one period's priorities", async () => {
      inPeriod().on("ReorderReviewItems", {
        update_minerva_review_items_many: [{ affected_rows: 1 }],
      });

      const res = await reorder({
        scope: "day",
        periodStart: "2026-10-02",
        kind: "priority",
        itemIds: [SECOND_ID, REVIEW_ITEM_ID],
      });

      expect(res.status).toBe(200);
      expect(res.body.reviewItems).toHaveLength(2);
      expect(ctx.t.graphql.calls("ReorderReviewItems")[0].variables).toEqual({
        updates: [
          {
            where: { id: { _eq: SECOND_ID }, userId: { _eq: USER } },
            _set: { position: 0 },
          },
          {
            where: { id: { _eq: REVIEW_ITEM_ID }, userId: { _eq: USER } },
            _set: { position: 1 },
          },
        ],
      });
    });

    it.each([
      ["one missing", [REVIEW_ITEM_ID]],
      ["one of another kind", [SECOND_ID, REVIEW_ITEM_ID, COPY_ID]],
    ])("answers 400 with %s, writing nothing", async (_, itemIds) => {
      inPeriod();

      const res = await reorder({
        scope: "day",
        periodStart: "2026-10-02",
        kind: "priority",
        itemIds,
      });

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("ReorderReviewItems")).toHaveLength(0);
    });

    it.each([
      ["no scope", { periodStart: "2026-10-02", kind: "todo", itemIds: [] }],
      [
        "a week from a Tuesday",
        { scope: "week", periodStart: "2026-10-06", kind: "todo", itemIds: [] },
      ],
      ["no IDs", { scope: "day", periodStart: "2026-10-02", kind: "todo" }],
    ])("answers 400 for %s, before Hasura", async (_, body) => {
      const res = await reorder(body);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("CarryReviewItem", () => {
    const carry = (body: object) =>
      ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/reviews/item/${REVIEW_ITEM_ID}/carry`)
          .send(body),
      );
    const carried = (copy = graphQlReviewItem({ id: COPY_ID })) =>
      ctx.t.graphql.on("CarryReviewItem", {
        update_minerva_review_items: { affected_rows: 1 },
        insert_minerva_review_items_one: copy,
      });

    it("carries Friday's open item to Saturday, counting the carry", async () => {
      described(graphQlReviewItem({ carryCount: 1 }));
      reviews();
      lastPosition(null);
      carried(
        graphQlReviewItem({
          id: COPY_ID,
          reviewId: FRIDAY_REVIEW_ID,
          periodStart: "2026-10-03",
          carriedFromId: REVIEW_ITEM_ID,
          carryCount: 2,
        }),
      );

      const res = await carry({ reviewId: FRIDAY_REVIEW_ID });

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/v1/minerva/reviews/item/${COPY_ID}`);
      expect(res.body.reviewItem).toMatchObject({
        carriedFromId: REVIEW_ITEM_ID,
        carryCount: 2,
      });
      const call = ctx.t.graphql.calls("CarryReviewItem")[0];
      expect(call.variables).toEqual({
        userId: USER,
        itemId: REVIEW_ITEM_ID,
        from: ["open", "someday"],
        copy: {
          userId: USER,
          reviewId: FRIDAY_REVIEW_ID,
          scope: "day",
          periodStart: "2026-10-03",
          kind: "priority",
          title: "Draft Q4 OKRs",
          position: 0,
          carriedFromId: REVIEW_ITEM_ID,
          carryCount: 2,
        },
      });
      expect(call.document).toContain('_set: { status: "carried" }');
    });

    it("carries a someday day item into next week", async () => {
      described(graphQlReviewItem({ status: "someday" }));
      reviews();
      lastPosition(3);
      carried();

      const res = await carry({ reviewId: FRIDAY_REVIEW_ID, scope: "week" });

      expect(res.status).toBe(201);
      expect(ctx.t.graphql.calls("CarryReviewItem")[0].variables).toMatchObject(
        {
          copy: { scope: "week", periodStart: "2026-10-05", position: 4 },
        },
      );
    });

    it.each([["done"], ["dropped"], ["carried"]])(
      "answers 409 for a %s item, carrying nothing",
      async (status) => {
        described(
          graphQlReviewItem({
            status,
            doneTime: status === "done" ? NOW : null,
          }),
        );
        reviews();

        const res = await carry({ reviewId: FRIDAY_REVIEW_ID });

        expect(res.status).toBe(409);
        expect(ctx.t.graphql.calls("CarryReviewItem")).toHaveLength(0);
      },
    );

    it("answers 400 when the copy would not be after the item's period", async () => {
      described();
      reviews();

      // Thursday's review would carry Friday's item to Friday.
      const res = await carry({ reviewId: REVIEW_ID });

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("CarryReviewItem")).toHaveLength(0);
    });

    it("answers 409 when the item was carried at the same time", async () => {
      described();
      reviews();
      lastPosition(null);
      ctx.t.graphql.on("CarryReviewItem", uniqueViolation);

      expect((await carry({ reviewId: FRIDAY_REVIEW_ID })).status).toBe(409);
    });

    it("answers 404 for someone else's review", async () => {
      described();
      reviews();

      const res = await carry({
        reviewId: "7b3e1d00-0000-4000-8000-0000000000ff",
      });

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("CarryReviewItem")).toHaveLength(0);
    });

    it("answers 404 for someone else's item", async () => {
      ctx.t.graphql.on("DescribeReviewItem", { minerva_review_items: [] });
      await ctx.signInAs(OTHER_USER);

      expect((await carry({ reviewId: FRIDAY_REVIEW_ID })).status).toBe(404);
    });

    it.each([
      ["no review", {}],
      ["a review ID that is no UUID", { reviewId: "friday" }],
      ["a month scope", { reviewId: FRIDAY_REVIEW_ID, scope: "month" }],
    ])("answers 400 for %s, before Hasura", async (_, body) => {
      const res = await carry(body);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DeleteReviewItem", () => {
    const remove = () =>
      ctx.as(ctx.t.http().delete(`${BASE}/reviews/item/${REVIEW_ITEM_ID}`));
    const deleted = (rows: number) =>
      ctx.t.graphql.on("DeleteReviewItem", {
        delete_minerva_review_items: { affected_rows: rows },
        update_minerva_review_items: { affected_rows: 1 },
      });

    it("deletes an item, reopening nothing", async () => {
      described();
      deleted(1);

      expect((await remove()).status).toBe(204);
      expect(ctx.t.graphql.calls("DeleteReviewItem")[0].variables).toEqual({
        userId: USER,
        itemId: REVIEW_ITEM_ID,
        fromId: REVIEW_ITEM_ID,
        reopen: false,
      });
    });

    it("undoes a carry: deleting the copy reopens what it came from", async () => {
      described(graphQlReviewItem({ carriedFromId: SECOND_ID, carryCount: 1 }));
      deleted(1);

      expect((await remove()).status).toBe(204);
      const call = ctx.t.graphql.calls("DeleteReviewItem")[0];
      expect(call.variables).toEqual({
        userId: USER,
        itemId: REVIEW_ITEM_ID,
        fromId: SECOND_ID,
        reopen: true,
      });
      expect(call.document).toContain('status: { _eq: "carried" }');
    });

    it("answers 404 for someone else's item", async () => {
      ctx.t.graphql.on("DescribeReviewItem", { minerva_review_items: [] });
      await ctx.signInAs(OTHER_USER);

      expect((await remove()).status).toBe(404);
      expect(ctx.t.graphql.calls("DeleteReviewItem")).toHaveLength(0);
    });
  });
});
