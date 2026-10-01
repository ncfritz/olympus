import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GOAL_CYCLE_ID, graphQlGoalCycle } from "../../fixtures/minerva";
import {
  OTHER_USER,
  signedInApp,
  uniqueViolation,
  USER,
} from "../../support/signedInApp";

const SECOND_ID = "2e7b4c90-0000-4000-8000-000000000002";
const BASE = "/v1/minerva/goals";
const PACIFIC = "America/Los_Angeles";

/**
 * The goal cycle operations over the real HTTP stack, on Oct 1 2026 at
 * noon in Seattle unless a test says otherwise.
 */
describe("Goal cycles API", () => {
  const ctx = signedInApp();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T19:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const list = () =>
    ctx.as(ctx.t.http().get(`${BASE}/cycles`).set("x-ncfritz-tz", PACIFIC));

  describe("without an identity", () => {
    it.each([
      ["get", `${BASE}/cycles`],
      ["post", `${BASE}/cycles`],
      ["get", `${BASE}/cycle/${GOAL_CYCLE_ID}`],
      ["put", `${BASE}/cycle/${GOAL_CYCLE_ID}`],
      ["delete", `${BASE}/cycle/${GOAL_CYCLE_ID}`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await ctx.t.http()[method](path);
        expect(res.status).toBe(401);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("ListGoalCycles", () => {
    it("lists the caller's cycles with where today falls", async () => {
      ctx.t.graphql.on("ListGoalCycles", {
        minerva_goal_cycles: [
          graphQlGoalCycle(),
          graphQlGoalCycle({
            id: SECOND_ID,
            name: "Cycle 3",
            startDate: "2026-06-08",
          }),
        ],
      });

      const res = await list();

      expect(res.status).toBe(200);
      expect(
        res.body.goalCycles.map(
          (c: { name: string; status: string; currentWeek?: number }) => [
            c.name,
            c.status,
            c.currentWeek,
          ],
        ),
      ).toEqual([
        ["Cycle 4", "current", 4],
        ["Cycle 3", "past", undefined],
      ]);
      expect(res.body.goalCycles[0]).toMatchObject({
        endDate: "2026-11-29",
        bufferEndDate: "2026-12-06",
      });
      expect(ctx.t.graphql.calls("ListGoalCycles")[0].variables).toEqual({
        userId: USER,
      });
    });

    it("takes today in the caller's timezone", async () => {
      // 21:00 on Sunday Dec 6 in Seattle, Monday Dec 7 in UTC.
      vi.setSystemTime(new Date("2026-12-07T05:00:00Z"));
      // A token signed on Oct 1 has long expired by December.
      await ctx.signInAs(USER);
      ctx.t.graphql.on("ListGoalCycles", {
        minerva_goal_cycles: [graphQlGoalCycle()],
      });

      const pacific = await list();
      const utc = await ctx.as(ctx.t.http().get(`${BASE}/cycles`));

      expect(pacific.body.goalCycles[0]).toMatchObject({
        status: "buffer",
        currentWeek: 13,
      });
      expect(utc.body.goalCycles[0].status).toBe("past");
    });

    it("answers 400 for a timezone it does not know, before Hasura", async () => {
      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/cycles`).set("x-ncfritz-tz", "Mars/Base"),
      );

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DescribeGoalCycle", () => {
    it("returns the cycle, scoped to the caller", async () => {
      ctx.t.graphql.on("DescribeGoalCycle", {
        minerva_goal_cycles: [graphQlGoalCycle()],
      });

      const res = await ctx.as(
        ctx.t
          .http()
          .get(`${BASE}/cycle/${GOAL_CYCLE_ID}`)
          .set("x-ncfritz-tz", PACIFIC),
      );

      expect(res.status).toBe(200);
      expect(res.body.goalCycle).toMatchObject({
        id: GOAL_CYCLE_ID,
        status: "current",
        currentWeek: 4,
      });
      expect(ctx.t.graphql.calls("DescribeGoalCycle")[0].variables).toEqual({
        userId: USER,
        cycleId: GOAL_CYCLE_ID,
      });
    });

    it("answers 404 for someone else's cycle", async () => {
      ctx.t.graphql.on("DescribeGoalCycle", { minerva_goal_cycles: [] });
      await ctx.signInAs(OTHER_USER);

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/cycle/${GOAL_CYCLE_ID}`),
      );

      expect(res.status).toBe(404);
    });

    it("answers 400 for an id that is not a UUID, before Hasura", async () => {
      const res = await ctx.as(ctx.t.http().get(`${BASE}/cycle/nope`));

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("CreateGoalCycle", () => {
    const create = (goalCycle: unknown) =>
      ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/cycles`)
          .set("x-ncfritz-tz", PACIFIC)
          .send({ goalCycle }),
      );

    it("creates a cycle after the last, with 12 + 1 weeks by default", async () => {
      ctx.t.graphql
        .on("ListGoalCycles", { minerva_goal_cycles: [graphQlGoalCycle()] })
        .on("CreateGoalCycle", {
          insert_minerva_goal_cycles_one: graphQlGoalCycle({
            id: SECOND_ID,
            name: "Cycle 5",
            startDate: "2026-12-07",
          }),
        });

      const res = await create({ name: "Cycle 5", startDate: "2026-12-07" });

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/v1/minerva/goals/cycle/${SECOND_ID}`);
      expect(res.body.goalCycle).toMatchObject({
        name: "Cycle 5",
        status: "upcoming",
      });
      expect(ctx.t.graphql.calls("CreateGoalCycle")[0].variables).toEqual({
        object: {
          userId: USER,
          name: "Cycle 5",
          startDate: "2026-12-07",
          weeks: 12,
          bufferWeeks: 1,
        },
      });
    });

    it("answers 409 for a cycle that would overlap another, buffer week included", async () => {
      ctx.t.graphql.on("ListGoalCycles", {
        minerva_goal_cycles: [graphQlGoalCycle()],
      });

      // Cycle 4's buffer week runs to Sunday Dec 6.
      const res = await create({ name: "Cycle 5", startDate: "2026-11-30" });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("Cycle 4");
      expect(ctx.t.graphql.calls("CreateGoalCycle")).toHaveLength(0);
    });

    it("answers 409 when Hasura refuses a second cycle on the same Monday", async () => {
      ctx.t.graphql
        .on("ListGoalCycles", { minerva_goal_cycles: [] })
        .on("CreateGoalCycle", uniqueViolation);

      const res = await create({ name: "Again", startDate: "2026-09-07" });

      expect(res.status).toBe(409);
    });

    it.each([
      ["a start that is not a Monday", { name: "a", startDate: "2026-09-08" }],
      ["a start that is not a date", { name: "a", startDate: "2026-02-30" }],
      ["a start with a time", { name: "a", startDate: "2026-09-07T00:00:00Z" }],
      ["no name", { startDate: "2026-09-07" }],
      ["too many weeks", { name: "a", startDate: "2026-09-07", weeks: 27 }],
      [
        "weeks that are not whole",
        { name: "a", startDate: "2026-09-07", weeks: 1.5 },
      ],
      [
        "three buffer weeks",
        { name: "a", startDate: "2026-09-07", bufferWeeks: 3 },
      ],
      ["no cycle", undefined],
    ])("answers 400 for %s, before Hasura", async (_, goalCycle) => {
      const res = await create(goalCycle);

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("UpdateGoalCycle", () => {
    const update = (goalCycle: unknown) =>
      ctx.as(
        ctx.t
          .http()
          .put(`${BASE}/cycle/${GOAL_CYCLE_ID}`)
          .set("x-ncfritz-tz", PACIFIC)
          .send({ goalCycle }),
      );

    it("changes only what differs", async () => {
      ctx.t.graphql
        .on("DescribeGoalCycle", { minerva_goal_cycles: [graphQlGoalCycle()] })
        .on("ListGoalCycles", { minerva_goal_cycles: [graphQlGoalCycle()] })
        .on("UpdateGoalCycle", {
          update_minerva_goal_cycles: {
            returning: [graphQlGoalCycle({ bufferWeeks: 2 })],
          },
        });

      const res = await update({ name: "Cycle 4", bufferWeeks: 2 });

      expect(res.status).toBe(200);
      expect(res.body.goalCycle.bufferEndDate).toBe("2026-12-13");
      expect(ctx.t.graphql.calls("UpdateGoalCycle")[0].variables).toEqual({
        userId: USER,
        cycleId: GOAL_CYCLE_ID,
        set: { bufferWeeks: 2 },
      });
    });

    it("answers 409 when the change would overlap the next cycle", async () => {
      ctx.t.graphql
        .on("DescribeGoalCycle", { minerva_goal_cycles: [graphQlGoalCycle()] })
        .on("ListGoalCycles", {
          minerva_goal_cycles: [
            graphQlGoalCycle({
              id: SECOND_ID,
              name: "Cycle 5",
              startDate: "2026-12-07",
            }),
            graphQlGoalCycle(),
          ],
        });

      const res = await update({ bufferWeeks: 2 });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("Cycle 5");
      expect(ctx.t.graphql.calls("UpdateGoalCycle")).toHaveLength(0);
    });

    it("answers 304 for an empty change", async () => {
      ctx.t.graphql.on("DescribeGoalCycle", {
        minerva_goal_cycles: [graphQlGoalCycle()],
      });

      const res = await update({});

      expect(res.status).toBe(304);
    });

    it("answers 404 for someone else's cycle, writing nothing", async () => {
      ctx.t.graphql.on("DescribeGoalCycle", { minerva_goal_cycles: [] });
      await ctx.signInAs(OTHER_USER);

      const res = await update({ name: "Mine" });

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("UpdateGoalCycle")).toHaveLength(0);
    });

    it("answers 400 for a start that is not a Monday, before Hasura", async () => {
      const res = await update({ startDate: "2026-09-09" });

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DeleteGoalCycle", () => {
    it("deletes the caller's cycle", async () => {
      ctx.t.graphql.on("DeleteGoalCycle", {
        delete_minerva_goal_cycles: { affected_rows: 1 },
      });

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/cycle/${GOAL_CYCLE_ID}`),
      );

      expect(res.status).toBe(204);
      expect(ctx.t.graphql.calls("DeleteGoalCycle")[0].variables).toEqual({
        userId: USER,
        cycleId: GOAL_CYCLE_ID,
      });
    });

    it("answers 404 for someone else's cycle", async () => {
      ctx.t.graphql.on("DeleteGoalCycle", {
        delete_minerva_goal_cycles: { affected_rows: 0 },
      });
      await ctx.signInAs(OTHER_USER);

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/cycle/${GOAL_CYCLE_ID}`),
      );

      expect(res.status).toBe(404);
    });
  });
});
