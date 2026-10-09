import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GOAL_CHECKIN_ID,
  GOAL_ID,
  graphQlGoal,
  graphQlGoalCheckin,
} from "../../fixtures/minerva";
import { OTHER_USER, signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva";
const PACIFIC = "America/Los_Angeles";
const BOOKS = "9b1c0000-0000-4000-8000-0000000000b1";

/**
 * Check-ins over the real HTTP stack, on Oct 1 2026 at noon in Seattle.
 * Hasura is a test double.
 */
describe("Goal check-ins API", () => {
  const ctx = signedInApp();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T19:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const pacific = <T extends { set: (k: string, v: string) => T }>(req: T) =>
    req.set("x-ncfritz-tz", PACIFIC);

  /** The goal the check-in operations read, with its check-ins latest first. */
  const target = (
    overrides: Record<string, unknown> = {},
    checkins: unknown[] = [graphQlGoalCheckin()],
  ) =>
    ctx.t.graphql.on("ListGoalCheckins", {
      minerva_goals: [
        {
          id: GOAL_ID,
          type: "milestone",
          status: "active",
          startDate: "2026-09-07",
          checkins,
          ...overrides,
        },
      ],
    });
  const outcome = { type: "outcome", startDate: "2026-01-01" };
  const noGoal = () =>
    ctx.t.graphql.on("ListGoalCheckins", { minerva_goals: [] });

  describe("without an identity", () => {
    it.each([
      ["get", `${BASE}/goal/${GOAL_ID}/checkins`],
      ["post", `${BASE}/goal/${GOAL_ID}/checkins`],
      ["get", `${BASE}/goal/${GOAL_ID}/checkin/suggestion`],
      ["put", `${BASE}/goal/${GOAL_ID}/checkin/${GOAL_CHECKIN_ID}`],
      ["delete", `${BASE}/goal/${GOAL_ID}/checkin/${GOAL_CHECKIN_ID}`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await ctx.t.http()[method](path);
        expect(res.status).toBe(401);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("ListGoalCheckins", () => {
    it("lists a goal's check-ins as Hasura orders them, latest first", async () => {
      target({}, [
        graphQlGoalCheckin({
          id: "7d4e0000-0000-4000-8000-000000000002",
          checkinDate: "2026-09-30",
          confidence: "at_risk",
          source: "weekly_review",
          note: null,
        }),
        graphQlGoalCheckin(),
      ]);

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/goal/${GOAL_ID}/checkins`),
      );

      expect(res.status).toBe(200);
      expect(res.body.goalCheckins).toHaveLength(2);
      expect(res.body.goalCheckins[0]).toMatchObject({
        checkinDate: "2026-09-30",
        confidence: "at_risk",
        source: "weekly_review",
      });
      expect(res.body.goalCheckins[0].note).toBeUndefined();
      expect(res.body.goalCheckins[1]).toMatchObject({
        id: GOAL_CHECKIN_ID,
        note: "Schema merged",
        createdTime: "2026-09-25T20:00:00.000Z",
      });
      expect(ctx.t.graphql.calls("ListGoalCheckins")[0]).toMatchObject({
        variables: { userId: USER, goalId: GOAL_ID },
      });
      expect(ctx.t.graphql.calls("ListGoalCheckins")[0].document).toMatch(
        /deletedTime: \{ _is_null: true \}/,
      );
    });

    it("answers 404 for someone else's goal", async () => {
      noGoal();
      await ctx.signInAs(OTHER_USER);

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/goal/${GOAL_ID}/checkins`),
      );

      expect(res.status).toBe(404);
      expect(
        ctx.t.graphql.calls("ListGoalCheckins")[0].variables,
      ).toMatchObject({ userId: OTHER_USER });
    });
  });

  describe("CreateGoalCheckin", () => {
    const create = (body: object) =>
      ctx.as(
        pacific(
          ctx.t.http().post(`${BASE}/goal/${GOAL_ID}/checkins`).send(body),
        ),
      );
    const created = () =>
      ctx.t.graphql.on("CreateGoalCheckin", (variables) => ({
        insert_minerva_goal_checkins_one: graphQlGoalCheckin({
          ...(variables as { object: object }).object,
        }),
      }));
    const object = () =>
      (
        ctx.t.graphql.calls("CreateGoalCheckin")[0]?.variables as
          { object: Record<string, unknown> } | undefined
      )?.object;

    it("checks in on an outcome goal today, from the goal page", async () => {
      target(outcome);
      created();

      const res = await create({
        goalCheckin: { value: 17, confidence: "on_track", note: " Two " },
      });

      expect(res.status).toBe(201);
      expect(res.headers.location).toBeUndefined();
      expect(res.body.goalCheckin).toMatchObject({
        checkinDate: "2026-10-01",
        value: 17,
        confidence: "on_track",
        source: "goal",
      });
      expect(object()).toEqual({
        goalId: GOAL_ID,
        checkinDate: "2026-10-01",
        value: 17,
        confidence: "on_track",
        note: "Two",
        source: "goal",
      });
    });

    it("takes an outcome's value alone, and a review as the source", async () => {
      target(outcome);
      created();

      const res = await create({
        goalCheckin: { value: 17.5, source: "daily_review" },
      });

      expect(res.status).toBe(201);
      expect(object()).toMatchObject({
        value: 17.5,
        confidence: null,
        source: "daily_review",
      });
    });

    it("takes a backfilled day", async () => {
      target();
      created();

      const res = await create({
        goalCheckin: { checkinDate: "2026-09-10", confidence: "at_risk" },
      });

      expect(res.status).toBe(201);
      expect(object()).toMatchObject({
        checkinDate: "2026-09-10",
        value: null,
      });
    });

    it.each([
      [PACIFIC, "2026-10-01"],
      ["Etc/UTC", "2026-10-02"],
    ])("dates a check-in by today in %s", async (tz, date) => {
      // 18:00 on Oct 1 in Seattle is already Oct 2 in UTC.
      vi.setSystemTime(new Date("2026-10-02T01:00:00Z"));
      await ctx.signInAs(USER);
      target();
      created();

      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/goal/${GOAL_ID}/checkins`)
          .set("x-ncfritz-tz", tz)
          .send({ goalCheckin: { confidence: "on_track" } }),
      );

      expect(res.status).toBe(201);
      expect(object()?.checkinDate).toBe(date);
    });

    it.each([
      ["no check-in", {}, "goalCheckin is required"],
      [
        "tomorrow",
        { goalCheckin: { checkinDate: "2026-10-02", confidence: "on_track" } },
        "checkinDate must not be after today, 2026-10-01",
      ],
      [
        "an unknown confidence",
        { goalCheckin: { confidence: "fine" } },
        "confidence must be one of on_track, at_risk, off_track",
      ],
      [
        "an unknown source",
        { goalCheckin: { confidence: "on_track", source: "ios" } },
        "source must be one of goal, daily_review, weekly_review",
      ],
      [
        "a value that is not a number",
        { goalCheckin: { value: "17" } },
        "value must be a number",
      ],
    ])("answers 400 for %s, before Hasura", async (_, body, problem) => {
      const res = await create(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(problem);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it.each([
      [
        "an outcome check-in with no value",
        outcome,
        { confidence: "on_track" },
        "a check-in on an outcome goal needs a value",
      ],
      [
        "a value on a milestone goal",
        {},
        { value: 3, confidence: "on_track" },
        "only outcome goals take a value",
      ],
      [
        "a milestone check-in with no confidence",
        {},
        { note: "Busy week" },
        "a check-in needs a confidence",
      ],
      [
        "a day before the goal starts",
        {},
        { checkinDate: "2026-09-01", confidence: "on_track" },
        "checkinDate must not be before the goal starts, 2026-09-07",
      ],
    ])(
      "answers 400 for %s, writing nothing",
      async (_, goal, checkin, problem) => {
        target(goal);

        const res = await create({ goalCheckin: checkin });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain(problem);
        expect(ctx.t.graphql.calls("CreateGoalCheckin")).toHaveLength(0);
      },
    );

    it("answers 409 for a closed goal", async () => {
      target({ status: "achieved" });

      const res = await create({ goalCheckin: { confidence: "on_track" } });

      expect(res.status).toBe(409);
      expect(ctx.t.graphql.calls("CreateGoalCheckin")).toHaveLength(0);
    });

    it("answers 404 for someone else's goal", async () => {
      noGoal();

      const res = await create({ goalCheckin: { confidence: "on_track" } });

      expect(res.status).toBe(404);
    });
  });

  describe("UpdateGoalCheckin", () => {
    const update = (body: object, checkinId = GOAL_CHECKIN_ID) =>
      ctx.as(
        pacific(
          ctx.t
            .http()
            .put(`${BASE}/goal/${GOAL_ID}/checkin/${checkinId}`)
            .send(body),
        ),
      );
    const returning = () =>
      ctx.t.graphql.on("UpdateGoalCheckin", (variables) => ({
        update_minerva_goal_checkins: {
          returning: [graphQlGoalCheckin((variables as { set: object }).set)],
        },
      }));
    const set = () =>
      (
        ctx.t.graphql.calls("UpdateGoalCheckin")[0]?.variables as
          { set: Record<string, unknown> } | undefined
      )?.set;

    it("changes what was said, and only that", async () => {
      target();
      returning();

      const res = await update({
        goalCheckin: { confidence: "at_risk", note: "Schema merged" },
      });

      expect(res.status).toBe(200);
      expect(res.body.goalCheckin.confidence).toBe("at_risk");
      expect(ctx.t.graphql.calls("UpdateGoalCheckin")[0].variables).toEqual({
        goalId: GOAL_ID,
        checkinId: GOAL_CHECKIN_ID,
        set: { confidence: "at_risk" },
      });
    });

    it("removes a note with null, and moves the day back", async () => {
      target();
      returning();

      const res = await update({
        goalCheckin: { note: null, checkinDate: "2026-09-24" },
      });

      expect(res.status).toBe(200);
      expect(set()).toEqual({ note: null, checkinDate: "2026-09-24" });
    });

    it("answers 304 when the request names nothing to change", async () => {
      target();

      const res = await update({ goalCheckin: {} });

      expect(res.status).toBe(304);
      expect(set()).toBeUndefined();
    });

    it("answers the check-in as it stands when it already is so", async () => {
      target();

      const res = await update({ goalCheckin: { confidence: "on_track" } });

      expect(res.status).toBe(200);
      expect(res.body.goalCheckin.id).toBe(GOAL_CHECKIN_ID);
      expect(set()).toBeUndefined();
    });

    it.each([
      [
        "an outcome check-in's value removed",
        { ...outcome },
        [graphQlGoalCheckin({ value: 17 })],
        { value: null },
        "a check-in on an outcome goal needs a value",
      ],
      [
        "a milestone check-in's confidence removed",
        {},
        [graphQlGoalCheckin()],
        { confidence: null },
        "a check-in needs a confidence",
      ],
    ])("answers 400 for %s", async (_, goal, checkins, change, problem) => {
      target(goal, checkins);

      const res = await update({ goalCheckin: change });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(problem);
      expect(set()).toBeUndefined();
    });

    it("answers 400 for a day after today, before Hasura", async () => {
      const res = await update({ goalCheckin: { checkinDate: "2026-10-02" } });

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it("answers 404 for a check-in on another goal", async () => {
      target();

      const res = await update(
        { goalCheckin: { confidence: "at_risk" } },
        "7d4e0000-0000-4000-8000-000000000009",
      );

      expect(res.status).toBe(404);
      expect(set()).toBeUndefined();
    });
  });

  describe("DeleteGoalCheckin", () => {
    const remove = () =>
      ctx.as(
        ctx.t
          .http()
          .delete(`${BASE}/goal/${GOAL_ID}/checkin/${GOAL_CHECKIN_ID}`),
      );

    it("removes a check-in", async () => {
      target();
      ctx.t.graphql.on("DeleteGoalCheckin", {
        delete_minerva_goal_checkins: { affected_rows: 1 },
      });

      const res = await remove();

      expect(res.status).toBe(204);
      expect(ctx.t.graphql.calls("DeleteGoalCheckin")[0].variables).toEqual({
        goalId: GOAL_ID,
        checkinId: GOAL_CHECKIN_ID,
      });
    });

    it("answers 404 for a check-in that is not there", async () => {
      target();
      ctx.t.graphql.on("DeleteGoalCheckin", {
        delete_minerva_goal_checkins: { affected_rows: 0 },
      });

      expect((await remove()).status).toBe(404);
    });

    it("answers 404 for someone else's goal, deleting nothing", async () => {
      noGoal();

      expect((await remove()).status).toBe(404);
      expect(ctx.t.graphql.calls("DeleteGoalCheckin")).toHaveLength(0);
    });
  });

  describe("SuggestGoalCheckin", () => {
    const suggest = (goalId = GOAL_ID) =>
      ctx.as(
        pacific(ctx.t.http().get(`${BASE}/goal/${goalId}/checkin/suggestion`)),
      );
    const goals = (...rows: unknown[]) =>
      ctx.t.graphql.on("ListGoals", { minerva_goals: rows });
    const books = graphQlGoal({
      id: BOOKS,
      title: "Read 24 books",
      type: "outcome",
      horizon: "year",
      cycleId: null,
      startDate: "2026-01-01",
      dueDate: "2026-12-31",
      progressMode: "checkins",
      unit: "books",
      startValue: 0,
      targetValue: 24,
      milestones: [],
      checkins: [
        {
          checkinDate: "2026-09-30",
          value: 17,
          confidence: null,
          createdTime: "2026-09-30T20:00:00Z",
        },
      ],
    });

    it("suggests an outcome's value against where pace puts it", async () => {
      goals(books);

      const res = await suggest(BOOKS);

      expect(res.status).toBe(200);
      // 17 of 24 is 70.8 %; pace says 75 %, 18 books, within the 10 % band.
      expect(res.body.suggestion).toEqual({
        checkinDate: "2026-10-01",
        progress: 70.8,
        currentValue: 17,
        expectedProgress: 75,
        expectedValue: 18,
        confidence: "on_track",
      });
    });

    it("suggests what the numbers say, whatever the last check-in said", async () => {
      // Two of six milestones (33.3 %) against 28.9 % pace is on track; the
      // check-in after the last milestone said off track, and still stands
      // as the goal's health.
      goals(
        graphQlGoal({
          checkins: [
            {
              checkinDate: "2026-09-25",
              value: null,
              confidence: "off_track",
              createdTime: "2026-09-25T20:00:00Z",
            },
          ],
        }),
      );

      const res = await suggest();

      expect(res.body.suggestion).toMatchObject({
        progress: 33.3,
        expectedProgress: 28.9,
        confidence: "on_track",
      });
      expect(res.body.suggestion.expectedValue).toBeUndefined();

      const goal = await ctx.as(
        pacific(ctx.t.http().get(`${BASE}/goal/${GOAL_ID}`)),
      );
      expect(goal.body.goal.health).toBe("off_track");
    });

    it("answers 404 for a deleted goal", async () => {
      goals(graphQlGoal({ deletedTime: "2026-09-30T12:00:00Z" }));

      expect((await suggest()).status).toBe(404);
    });
  });
});
