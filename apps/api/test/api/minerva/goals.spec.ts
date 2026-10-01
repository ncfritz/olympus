import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GOAL_CATEGORY_ID,
  GOAL_CYCLE_ID,
  GOAL_ID,
  graphQlGoal,
  graphQlGoalMilestone,
  GOAL_MILESTONE_ID,
  graphQlTag,
  TAG_ID,
} from "../../fixtures/minerva";
import { OTHER_USER, signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva";
const PACIFIC = "America/Los_Angeles";
const YEAR = "9b1c0000-0000-4000-8000-0000000000a1";
const CHILD = "9b1c0000-0000-4000-8000-0000000000a2";
const LEAF = "9b1c0000-0000-4000-8000-0000000000a3";
const BOOKS = "9b1c0000-0000-4000-8000-0000000000b1";
const RUN = "9b1c0000-0000-4000-8000-0000000000c1";

/** Read the books goal at 17 of 24: a check-in it does not have yet (phase 4), so 0. */
const books = (overrides = {}) =>
  graphQlGoal({
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
    goalTags: [],
    position: 1,
    ...overrides,
  });

const run = (overrides = {}) =>
  graphQlGoal({
    id: RUN,
    title: "Run 3× a week",
    type: "habit",
    horizon: "ongoing",
    cycleId: null,
    startDate: "2026-09-14",
    dueDate: null,
    progressMode: "habit",
    milestones: [],
    goalTags: [],
    position: 2,
    habitRule: {
      frequency: "weekly",
      timesPerPeriod: 3,
      weekdays: null,
      quantityTarget: null,
      quantityUnit: null,
      createdTime: "2026-09-14T12:00:00Z",
      lastUpdatedTime: null,
    },
    ...overrides,
  });

/**
 * The goal operations over the real HTTP stack, on Oct 1 2026 at noon in
 * Seattle. Hasura is a test double: these prove what the API sends and how
 * it shapes what comes back, the engine's own tables prove the arithmetic.
 */
describe("Goals API", () => {
  const ctx = signedInApp();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T19:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const goals = (...rows: unknown[]) =>
    ctx.t.graphql.on("ListGoals", { minerva_goals: rows });
  const pacific = <T extends { set: (k: string, v: string) => T }>(req: T) =>
    req.set("x-ncfritz-tz", PACIFIC);

  describe("without an identity", () => {
    it.each([
      ["get", `${BASE}/goals`],
      ["post", `${BASE}/goals`],
      ["put", `${BASE}/goals/order`],
      ["get", `${BASE}/goal/${GOAL_ID}`],
      ["put", `${BASE}/goal/${GOAL_ID}`],
      ["delete", `${BASE}/goal/${GOAL_ID}`],
      ["post", `${BASE}/goal/${GOAL_ID}/restore`],
      ["post", `${BASE}/goal/${GOAL_ID}/milestones`],
      ["put", `${BASE}/goal/${GOAL_ID}/milestones/order`],
      ["put", `${BASE}/goal/${GOAL_ID}/milestone/${GOAL_ID}`],
      ["delete", `${BASE}/goal/${GOAL_ID}/milestone/${GOAL_ID}`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await ctx.t.http()[method](path);
        expect(res.status).toBe(401);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("ListGoals", () => {
    const list = (query = "") =>
      ctx.as(pacific(ctx.t.http().get(`${BASE}/goals${query}`)));

    it("lists the caller's open goals with their progress, pace and health", async () => {
      goals(
        graphQlGoal(),
        books(),
        run(),
        graphQlGoal({
          id: CHILD,
          title: "Achieved",
          status: "achieved",
          closedOn: "2026-09-30",
          position: 3,
        }),
        graphQlGoal({
          id: LEAF,
          title: "Deleted",
          deletedTime: "2026-09-30T12:00:00Z",
          position: 4,
        }),
      );

      const res = await list();

      expect(res.status).toBe(200);
      expect(ctx.t.graphql.calls("ListGoals")[0].variables).toEqual({
        userId: USER,
      });
      expect(res.body.goals.map((g: { title: string }) => g.title)).toEqual([
        "Ship Minerva Goals v1",
        "Read 24 books",
        "Run 3× a week",
      ]);
      // 2 of 6 milestones; 24 of 83 days gone.
      expect(res.body.goals[0]).toMatchObject({
        id: GOAL_ID,
        progress: 33.3,
        expectedProgress: 28.9,
        health: "on_track",
        tagIds: [TAG_ID],
        subGoalIds: [],
        deleted: false,
      });
      // No check-ins until phase 4: at its start value, behind a 75 % pace.
      expect(res.body.goals[1]).toMatchObject({
        progress: 0,
        currentValue: 0,
        expectedProgress: 75,
        health: "off_track",
      });
      // No logs yet, a habit is behind.
      expect(res.body.goals[2]).toMatchObject({
        progress: 0,
        health: "off_track",
      });
      expect(res.body.goals[2].expectedProgress).toBeUndefined();
    });

    it("rolls a three-level tree up from its leaves", async () => {
      goals(
        graphQlGoal({
          id: YEAR,
          title: "Minerva productivity suite",
          parentId: null,
          horizon: "year",
          cycleId: null,
          startDate: "2026-01-01",
          dueDate: "2026-12-31",
          progressMode: "subgoals",
          rollup: "average",
          milestones: [],
        }),
        graphQlGoal({
          id: CHILD,
          parentId: YEAR,
          progressMode: "subgoals",
          rollup: "weighted",
          milestones: [],
          position: 1,
        }),
        graphQlGoal({ id: LEAF, parentId: CHILD, weight: 3, position: 2 }),
        graphQlGoal({
          id: GOAL_ID,
          parentId: CHILD,
          weight: 1,
          position: 3,
          milestones: [],
        }),
      );

      const res = await list();
      const byId = Object.fromEntries(
        res.body.goals.map((g: { id: string }) => [g.id, g]),
      );

      // The leaf is 33.3 %, its sibling (no milestones) 0: weighted 3 to 1.
      expect(byId[CHILD].progress).toBe(25);
      expect(byId[YEAR].progress).toBe(25);
      expect(byId[YEAR].subGoalIds).toEqual([CHILD]);
      expect(byId[CHILD].subGoalIds).toEqual([LEAF, GOAL_ID]);
    });

    it("filters by category, tag, parent and status", async () => {
      const rows = [
        graphQlGoal(),
        books({
          categoryId: "6a2d9e40-0000-4000-8000-000000000002",
          goalTags: [{ tag: graphQlTag() }],
        }),
        graphQlGoal({
          id: CHILD,
          parentId: GOAL_ID,
          goalTags: [],
          position: 3,
          status: "missed",
          closedOn: "2026-09-30",
        }),
      ];
      goals(...rows);

      const ids = async (query: string) =>
        (await list(query)).body.goals.map((g: { id: string }) => g.id);

      expect(await ids(`?categoryId=${GOAL_CATEGORY_ID}`)).toEqual([GOAL_ID]);
      expect(await ids(`?tagId=${TAG_ID}`)).toEqual([GOAL_ID, BOOKS]);
      expect(await ids("?parentId=none")).toEqual([GOAL_ID, BOOKS]);
      expect(await ids(`?parentId=${GOAL_ID}&status=missed`)).toEqual([CHILD]);
      expect(await ids("?status=missed,achieved")).toEqual([CHILD]);
      expect(await ids(`?cycleId=${GOAL_CYCLE_ID}&horizon=cycle`)).toEqual([
        GOAL_ID,
      ]);
    });

    it.each([
      ["an unknown status", "?status=done"],
      ["a category that is not an ID", "?categoryId=health"],
      ["a parent that is not an ID", "?parentId=top"],
      ["an unknown horizon", "?horizon=decade"],
      ["a repeated tag", `?tagId=${TAG_ID}&tagId=${TAG_ID}`],
    ])("answers 400 for %s, before Hasura", async (_, query) => {
      const res = await list(query);

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DescribeGoal", () => {
    it("returns the goal in full", async () => {
      goals(
        graphQlGoal(),
        graphQlGoal({
          id: CHILD,
          parentId: GOAL_ID,
          title: "Sub",
          position: 1,
        }),
        graphQlGoal({
          id: LEAF,
          parentId: GOAL_ID,
          title: "Deleted sub",
          deletedTime: "2026-09-30T12:00:00Z",
          position: 2,
        }),
      );

      const res = await ctx.as(
        pacific(ctx.t.http().get(`${BASE}/goal/${GOAL_ID}`)),
      );

      expect(res.status).toBe(200);
      expect(res.body.goal).toMatchObject({
        id: GOAL_ID,
        progress: 33.3,
        subGoalIds: [CHILD],
        tags: [{ id: TAG_ID, name: "olympus", goalCount: 3 }],
      });
      expect(res.body.goal.milestones).toHaveLength(6);
      expect(res.body.goal.milestones[0]).toMatchObject({
        title: "Data model and migrations",
        done: true,
      });
      expect(res.body.goal.milestones[2].done).toBe(false);
      expect(
        res.body.goal.subGoals.map((g: { title: string }) => g.title),
      ).toEqual(["Sub"]);
      expect(res.body.goal.habitRule).toBeUndefined();
    });

    it("returns a habit's rule, its weekdays as ISO days", async () => {
      goals(
        run({
          habitRule: {
            frequency: "weekdays",
            timesPerPeriod: 1,
            weekdays: 21,
            quantityTarget: 30,
            quantityUnit: "min",
            createdTime: "2026-09-14T12:00:00Z",
            lastUpdatedTime: null,
          },
        }),
      );

      const res = await ctx.as(ctx.t.http().get(`${BASE}/goal/${RUN}`));

      expect(res.body.goal.habitRule).toMatchObject({
        frequency: "weekdays",
        weekdays: [1, 3, 5],
        quantityTarget: 30,
        quantityUnit: "min",
      });
    });

    it("describes a deleted goal, marked deleted", async () => {
      goals(graphQlGoal({ deletedTime: "2026-09-30T12:00:00Z" }));

      const res = await ctx.as(ctx.t.http().get(`${BASE}/goal/${GOAL_ID}`));

      expect(res.status).toBe(200);
      expect(res.body.goal.deleted).toBe(true);
    });

    it("answers 404 for someone else's goal", async () => {
      goals();
      await ctx.signInAs(OTHER_USER);

      const res = await ctx.as(ctx.t.http().get(`${BASE}/goal/${GOAL_ID}`));

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("ListGoals")[0].variables).toEqual({
        userId: OTHER_USER,
      });
    });

    it("answers 400 for an id that is not a UUID, before Hasura", async () => {
      const res = await ctx.as(ctx.t.http().get(`${BASE}/goal/nope`));

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  /** ListGoals answering each list in turn, the last one from then on. */
  const goalsInTurn = (...lists: unknown[][]) => {
    let call = 0;
    ctx.t.graphql.on("ListGoals", () => ({
      minerva_goals: structuredClone(lists[Math.min(call++, lists.length - 1)]),
    }));
  };
  const references = ({
    categories = [{ id: GOAL_CATEGORY_ID, archivedTime: null }] as {
      id: string;
      archivedTime: string | null;
    }[],
    cycles = [] as unknown[],
    tags = [] as unknown[],
  } = {}) =>
    ctx.t.graphql.on("GetGoalReferences", {
      minerva_goal_categories: categories,
      minerva_goal_cycles: cycles,
      minerva_tags: tags,
    });
  const NONE = { id: { _in: [] } };
  const OTHER_TAG = "4c8e1f20-0000-4000-8000-000000000002";
  const CYCLE_4 = {
    id: GOAL_CYCLE_ID,
    startDate: "2026-09-07",
    weeks: 12,
    bufferWeeks: 1,
  };

  describe("CreateGoal", () => {
    const create = (body: object) =>
      ctx.as(pacific(ctx.t.http().post(`${BASE}/goals`).send(body)));
    const READ = {
      categoryId: GOAL_CATEGORY_ID,
      title: "Read 24 books",
      type: "outcome",
      horizon: "year",
      startDate: "2026-01-01",
      dueDate: "2026-12-31",
      unit: "books",
      startValue: 0,
      targetValue: 24,
    };

    it("creates a cycle goal on its cycle's dates, with milestones and tags, last in order", async () => {
      goalsInTurn(
        [books(), run()],
        [books(), run(), graphQlGoal({ position: 3 })],
      );
      references({ cycles: [CYCLE_4], tags: [{ id: TAG_ID }] });
      ctx.t.graphql.on("CreateGoal", {
        insert_minerva_goals_one: { id: GOAL_ID },
      });

      const res = await create({
        goal: {
          categoryId: GOAL_CATEGORY_ID,
          cycleId: GOAL_CYCLE_ID,
          title: "Ship Minerva Goals v1",
          type: "milestone",
          horizon: "cycle",
        },
        milestones: [
          { title: "Data model and migrations", dueDate: "2026-09-18" },
          { title: "Hasura actions and triggers", weight: 2 },
        ],
        tagIds: [TAG_ID],
      });

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/v1/minerva/goal/${GOAL_ID}`);
      expect(res.body.goal).toMatchObject({
        id: GOAL_ID,
        title: "Ship Minerva Goals v1",
      });
      expect(ctx.t.graphql.calls("GetGoalReferences")[0].variables).toEqual({
        categoryWhere: { id: { _eq: GOAL_CATEGORY_ID }, userId: { _eq: USER } },
        cycleWhere: { id: { _eq: GOAL_CYCLE_ID }, userId: { _eq: USER } },
        tagWhere: { id: { _in: [TAG_ID] }, userId: { _eq: USER } },
      });
      expect(ctx.t.graphql.calls("CreateGoal")[0].variables).toEqual({
        object: {
          userId: USER,
          categoryId: GOAL_CATEGORY_ID,
          parentId: null,
          cycleId: GOAL_CYCLE_ID,
          title: "Ship Minerva Goals v1",
          why: null,
          type: "milestone",
          status: "active",
          horizon: "cycle",
          startDate: "2026-09-07",
          dueDate: "2026-11-29",
          progressMode: "milestones",
          rollup: null,
          weight: 1,
          manualProgress: null,
          unit: null,
          startValue: null,
          targetValue: null,
          tolerancePct: 10,
          closedOn: null,
          closeNote: null,
          position: 3,
          milestones: {
            data: [
              {
                title: "Data model and migrations",
                dueDate: "2026-09-18",
                weight: 1,
                position: 0,
              },
              {
                title: "Hasura actions and triggers",
                dueDate: null,
                weight: 2,
                position: 1,
              },
            ],
          },
          goalTags: { data: [{ tagId: TAG_ID }] },
        },
      });
    });

    it("keeps a cycle goal's own dates when it gives them", async () => {
      goalsInTurn([], [graphQlGoal()]);
      references({ cycles: [CYCLE_4] });
      ctx.t.graphql.on("CreateGoal", {
        insert_minerva_goals_one: { id: GOAL_ID },
      });

      const res = await create({
        goal: {
          categoryId: GOAL_CATEGORY_ID,
          cycleId: GOAL_CYCLE_ID,
          title: "Ship it",
          type: "achievement",
          horizon: "cycle",
          dueDate: "2026-10-30",
        },
      });

      expect(res.status).toBe(201);
      const { object } = ctx.t.graphql.calls("CreateGoal")[0].variables as {
        object: Record<string, unknown>;
      };
      expect(object).toMatchObject({
        startDate: "2026-09-07",
        dueDate: "2026-10-30",
        progressMode: "status",
        position: 0,
      });
      expect(object).not.toHaveProperty("milestones");
      expect(object).not.toHaveProperty("goalTags");
    });

    it("creates a habit with its rule, the weekdays as a mask", async () => {
      goalsInTurn([], [run()]);
      references();
      ctx.t.graphql.on("CreateGoal", { insert_minerva_goals_one: { id: RUN } });

      const res = await create({
        goal: {
          categoryId: GOAL_CATEGORY_ID,
          title: "Stretch",
          type: "habit",
          horizon: "ongoing",
          startDate: "2026-10-01",
        },
        habitRule: { frequency: "weekdays", weekdays: [5, 1, 3] },
      });

      expect(res.status).toBe(201);
      expect(
        ctx.t.graphql.calls("GetGoalReferences")[0].variables,
      ).toMatchObject({ cycleWhere: NONE, tagWhere: NONE });
      expect(ctx.t.graphql.calls("CreateGoal")[0].variables).toMatchObject({
        object: {
          progressMode: "habit",
          dueDate: null,
          habitRule: {
            data: {
              frequency: "weekdays",
              timesPerPeriod: 1,
              weekdays: 21,
              quantityTarget: null,
              quantityUnit: null,
            },
          },
        },
      });
    });

    it.each([
      ["no goal", {}, "goal is required"],
      [
        "an outcome with no target",
        { goal: { ...READ, targetValue: undefined } },
        "an outcome goal needs a startValue and a targetValue",
      ],
      [
        "a mode its type does not allow",
        { goal: { ...READ, progressMode: "manual" } },
        "progressMode for a outcome goal must be one of checkins, subgoals",
      ],
      [
        "a sub-goal mode with no rollup",
        { goal: { ...READ, progressMode: "subgoals" } },
        "rollup is needed exactly when progress comes from sub-goals",
      ],
      [
        "a closed status",
        { goal: { ...READ, status: "achieved", closedOn: "2026-10-01" } },
        "a new goal is draft or active",
      ],
      [
        "a due date before the start",
        { goal: { ...READ, dueDate: "2025-12-31" } },
        "dueDate must not be before startDate",
      ],
      [
        "a cycle goal with no cycle",
        { goal: { ...READ, horizon: "cycle" } },
        "a cycle goal needs a cycleId, and only a cycle goal has one",
      ],
      [
        "a habit with no rule",
        {
          goal: {
            categoryId: GOAL_CATEGORY_ID,
            title: "Stretch",
            type: "habit",
            horizon: "ongoing",
            startDate: "2026-10-01",
          },
        },
        "a habit goal needs a habitRule",
      ],
      [
        "milestones on an outcome",
        { goal: READ, milestones: [{ title: "Half way" }] },
        "only milestone goals have milestones",
      ],
      [
        "a habit rule on an outcome",
        { goal: READ, habitRule: { frequency: "daily" } },
        "only habit goals have a habitRule",
      ],
      [
        "a tag named twice",
        { goal: READ, tagIds: [TAG_ID, TAG_ID] },
        "tagIds must not name an ID twice",
      ],
      [
        "a title too long",
        { goal: { ...READ, title: "x".repeat(121) } },
        "title must be 1 to 120 characters",
      ],
    ])("answers 400 for %s, before Hasura", async (_, body, problem) => {
      const res = await create(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(problem);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it.each([
      [
        "someone else's category",
        { categories: [] },
        {},
        "categoryId names no category of yours",
      ],
      [
        "an archived category",
        {
          categories: [
            { id: GOAL_CATEGORY_ID, archivedTime: "2026-09-01T00:00:00Z" },
          ],
        },
        {},
        "categoryId names an archived category",
      ],
      [
        "someone else's tag",
        {},
        { tagIds: [TAG_ID] },
        "tagIds must name tags of yours",
      ],
      [
        "a deleted parent",
        {},
        { goal: { ...READ, parentId: YEAR } },
        "parentId names no goal of yours",
      ],
    ])(
      "answers 400 for %s, creating nothing",
      async (_, refs, body, problem) => {
        goals(graphQlGoal({ id: YEAR, deletedTime: "2026-09-30T12:00:00Z" }));
        references(refs);

        const res = await create({ goal: READ, ...body });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain(problem);
        expect(ctx.t.graphql.calls("CreateGoal")).toHaveLength(0);
      },
    );
  });

  describe("UpdateGoal", () => {
    const update = (body: object, goalId = GOAL_ID) =>
      ctx.as(pacific(ctx.t.http().put(`${BASE}/goal/${goalId}`).send(body)));
    const mutation = () =>
      ctx.t.graphql.calls("UpdateGoal")[0]?.variables as
        Record<string, unknown> | undefined;
    const updated = () =>
      ctx.t.graphql.on("UpdateGoal", {
        update_minerva_goals: { affected_rows: 1 },
      });

    it("renames and retags a goal in one mutation, leaving kept tags alone", async () => {
      goalsInTurn([graphQlGoal()], [graphQlGoal({ title: "Ship Goals v1" })]);
      references({ categories: [], tags: [{ id: OTHER_TAG }] });
      updated();

      const res = await update({
        goal: { title: "Ship Goals v1" },
        tagIds: [OTHER_TAG],
      });

      expect(res.status).toBe(200);
      expect(res.body.goal.title).toBe("Ship Goals v1");
      expect(ctx.t.graphql.calls("GetGoalReferences")[0].variables).toEqual({
        categoryWhere: NONE,
        cycleWhere: NONE,
        tagWhere: { id: { _in: [OTHER_TAG] }, userId: { _eq: USER } },
      });
      expect(mutation()).toEqual({
        userId: USER,
        goalId: GOAL_ID,
        set: { title: "Ship Goals v1" },
        hasSet: true,
        rule: { goalId: GOAL_ID },
        hasRule: false,
        removeTagIds: [TAG_ID],
        addTags: [{ goalId: GOAL_ID, tagId: OTHER_TAG }],
        hasTags: true,
      });
    });

    it("answers 304 when the request names nothing to change", async () => {
      goals(graphQlGoal());

      const res = await update({ goal: { colour: "red" } });

      expect(res.status).toBe(304);
      expect(mutation()).toBeUndefined();
    });

    it("answers the goal as it stands when every change is already so", async () => {
      goals(graphQlGoal());
      references({ categories: [], tags: [{ id: TAG_ID }] });

      const res = await update({
        goal: { title: "Ship Minerva Goals v1", weight: 1 },
        tagIds: [TAG_ID],
      });

      expect(res.status).toBe(200);
      expect(res.body.goal.title).toBe("Ship Minerva Goals v1");
      expect(mutation()).toBeUndefined();
    });

    it("clears the closing date when a closed goal is reopened", async () => {
      goals(graphQlGoal({ status: "achieved", closedOn: "2026-09-30" }));
      references({ categories: [] });
      updated();

      const res = await update({ goal: { status: "active" } });

      expect(res.status).toBe(200);
      expect(mutation()).toMatchObject({
        set: { status: "active", closedOn: null },
        hasSet: true,
        hasTags: false,
      });
    });

    it("closes a goal with its date and note", async () => {
      goals(graphQlGoal());
      references({ categories: [] });
      updated();

      const res = await update({
        goal: {
          status: "dropped",
          closedOn: "2026-10-01",
          closeNote: "Folded into Minerva v2",
        },
      });

      expect(res.status).toBe(200);
      expect(mutation()?.set).toEqual({
        status: "dropped",
        closedOn: "2026-10-01",
        closeNote: "Folded into Minerva v2",
      });
    });

    it("moves a goal to another cycle, checking the cycle is the caller's", async () => {
      const NEXT = "6d2a0000-0000-4000-8000-000000000002";
      goals(graphQlGoal());
      references({ categories: [], cycles: [{ ...CYCLE_4, id: NEXT }] });
      updated();

      const res = await update({ goal: { cycleId: NEXT } });

      expect(res.status).toBe(200);
      expect(
        ctx.t.graphql.calls("GetGoalReferences")[0].variables,
      ).toMatchObject({
        cycleWhere: { id: { _eq: NEXT }, userId: { _eq: USER } },
      });
      expect(mutation()?.set).toEqual({ cycleId: NEXT });
    });

    it("upserts a habit's changed rule and nothing else", async () => {
      goals(run());
      references({ categories: [] });
      updated();

      const res = await update(
        { habitRule: { frequency: "weekly", timesPerPeriod: 4 } },
        RUN,
      );

      expect(res.status).toBe(200);
      expect(mutation()).toMatchObject({
        set: {},
        hasSet: false,
        rule: {
          goalId: RUN,
          frequency: "weekly",
          timesPerPeriod: 4,
          weekdays: null,
          quantityTarget: null,
          quantityUnit: null,
        },
        hasRule: true,
        hasTags: false,
      });
    });

    it("leaves an unchanged habit rule alone", async () => {
      goals(run());
      references({ categories: [] });

      const res = await update(
        { habitRule: { frequency: "weekly", timesPerPeriod: 3 } },
        RUN,
      );

      expect(res.status).toBe(200);
      expect(mutation()).toBeUndefined();
    });

    it.each([
      [
        "a change of type",
        { goal: { type: "outcome" } },
        "a goal's type cannot change; create a new goal instead",
      ],
      [
        "a tag list that is not IDs",
        { tagIds: ["olympus"] },
        "tagIds must be a list of IDs",
      ],
      [
        "a goal that is not an object",
        { goal: "done" },
        "goal must be an object",
      ],
    ])("answers 400 for %s, before Hasura", async (_, body, problem) => {
      const res = await update(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(problem);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it.each([
      [
        "closing with no date",
        { goal: { status: "achieved" } },
        "closedOn is needed exactly when the goal is achieved, missed or dropped",
      ],
      [
        "a habit rule on a milestone goal",
        { habitRule: { frequency: "daily" } },
        "only habit goals have a habitRule",
      ],
      [
        "manual progress with no value",
        { goal: { progressMode: "manual" } },
        "manualProgress is needed exactly when progress is set by hand",
      ],
      [
        "a parent that is its own sub-goal",
        { goal: { parentId: CHILD } },
        "a goal cannot sit under itself or one of its sub-goals",
      ],
      [
        "a parent that is deleted",
        { goal: { parentId: LEAF } },
        "parentId names no goal of yours",
      ],
    ])("answers 400 for %s, changing nothing", async (_, body, problem) => {
      goals(
        graphQlGoal(),
        graphQlGoal({ id: CHILD, parentId: GOAL_ID, position: 1 }),
        graphQlGoal({
          id: LEAF,
          deletedTime: "2026-09-30T12:00:00Z",
          position: 2,
        }),
      );

      const res = await update(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(problem);
      expect(mutation()).toBeUndefined();
    });

    it("answers 400 for a category that is archived", async () => {
      const OTHER = "5f0b0000-0000-4000-8000-000000000009";
      goals(graphQlGoal());
      references({
        categories: [{ id: OTHER, archivedTime: "2026-09-01T00:00:00Z" }],
      });

      const res = await update({ goal: { categoryId: OTHER } });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        "categoryId names an archived category",
      );
      expect(mutation()).toBeUndefined();
    });

    it.each([
      [
        "a deleted goal",
        [graphQlGoal({ deletedTime: "2026-09-30T12:00:00Z" })],
      ],
      ["someone else's goal", []],
    ])("answers 404 for %s", async (_, rows) => {
      goals(...rows);

      const res = await update({ goal: { title: "Mine now" } });

      expect(res.status).toBe(404);
      expect(mutation()).toBeUndefined();
    });
  });

  describe("DeleteGoal", () => {
    const remove = (goalId = GOAL_ID) =>
      ctx.as(ctx.t.http().delete(`${BASE}/goal/${goalId}`));

    it("deletes a goal softly, stamping the time", async () => {
      goals(
        graphQlGoal(),
        graphQlGoal({
          id: CHILD,
          parentId: GOAL_ID,
          deletedTime: "2026-09-30T12:00:00Z",
        }),
      );
      ctx.t.graphql.on("DeleteGoal", {
        update_minerva_goals: { affected_rows: 1 },
      });

      const res = await remove();

      expect(res.status).toBe(204);
      expect(ctx.t.graphql.calls("DeleteGoal")[0].variables).toEqual({
        userId: USER,
        goalId: GOAL_ID,
        now: "2026-10-01T19:00:00.000Z",
      });
    });

    it("answers 409 for a goal with live sub-goals", async () => {
      goals(
        graphQlGoal(),
        graphQlGoal({ id: CHILD, parentId: GOAL_ID, position: 1 }),
      );

      const res = await remove();

      expect(res.status).toBe(409);
      expect(ctx.t.graphql.calls("DeleteGoal")).toHaveLength(0);
    });

    it.each([
      [
        "a goal already deleted",
        [graphQlGoal({ deletedTime: "2026-09-30T12:00:00Z" })],
      ],
      ["someone else's goal", []],
    ])("answers 404 for %s", async (_, rows) => {
      goals(...rows);

      const res = await remove();

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("DeleteGoal")).toHaveLength(0);
    });

    it("answers 404 when the goal goes before the mutation lands", async () => {
      goals(graphQlGoal());
      ctx.t.graphql.on("DeleteGoal", {
        update_minerva_goals: { affected_rows: 0 },
      });

      expect((await remove()).status).toBe(404);
    });
  });

  describe("RestoreGoal", () => {
    const restore = (goalId = GOAL_ID) =>
      ctx.as(pacific(ctx.t.http().post(`${BASE}/goal/${goalId}/restore`)));
    const deleted = { deletedTime: "2026-09-30T12:00:00Z" };

    it("brings a deleted goal back", async () => {
      goalsInTurn([graphQlGoal(deleted)], [graphQlGoal()]);
      ctx.t.graphql.on("RestoreGoal", {
        update_minerva_goals: { affected_rows: 1 },
      });

      const res = await restore();

      expect(res.status).toBe(200);
      expect(res.body.goal).toMatchObject({ id: GOAL_ID, deleted: false });
      expect(ctx.t.graphql.calls("RestoreGoal")[0].variables).toEqual({
        userId: USER,
        goalId: GOAL_ID,
      });
    });

    it.each([
      ["a goal that is not deleted", [graphQlGoal()]],
      [
        "a goal whose parent is deleted",
        [
          graphQlGoal({ id: YEAR, ...deleted }),
          graphQlGoal({ parentId: YEAR, ...deleted }),
        ],
      ],
    ])("answers 409 for %s", async (_, rows) => {
      goals(...rows);

      const res = await restore();

      expect(res.status).toBe(409);
      expect(ctx.t.graphql.calls("RestoreGoal")).toHaveLength(0);
    });

    it("answers 404 for someone else's goal", async () => {
      goals();

      expect((await restore()).status).toBe(404);
    });
  });

  describe("ReorderGoals", () => {
    const reorder = (body: object) =>
      ctx.as(pacific(ctx.t.http().put(`${BASE}/goals/order`).send(body)));

    it("shares the named goals' positions out in the order given", async () => {
      goals(
        graphQlGoal({ position: 0 }),
        books({ position: 4 }),
        run({ position: 7 }),
      );
      ctx.t.graphql.on("ReorderGoals", {
        update_minerva_goals_many: [{ affected_rows: 1 }, { affected_rows: 1 }],
      });

      const res = await reorder({ goalIds: [RUN, BOOKS] });

      expect(res.status).toBe(200);
      expect(res.body.goals.map((g: { id: string }) => g.id)).toEqual([
        RUN,
        BOOKS,
      ]);
      expect(ctx.t.graphql.calls("ReorderGoals")[0].variables).toEqual({
        updates: [
          {
            where: { id: { _eq: RUN }, userId: { _eq: USER } },
            _set: { position: 4 },
          },
          {
            where: { id: { _eq: BOOKS }, userId: { _eq: USER } },
            _set: { position: 7 },
          },
        ],
      });
    });

    it.each([
      ["no list", {}, "goalIds must be a list of IDs"],
      ["an empty list", { goalIds: [] }, "goalIds must name at least one goal"],
      [
        "a goal named twice",
        { goalIds: [RUN, RUN] },
        "goalIds must not name an ID twice",
      ],
    ])("answers 400 for %s, before Hasura", async (_, body, problem) => {
      const res = await reorder(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(problem);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it("answers 400 for a goal that is not the caller's, or is deleted", async () => {
      goals(books(), run({ deletedTime: "2026-09-30T12:00:00Z" }));

      const res = await reorder({ goalIds: [BOOKS, RUN] });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("goalIds must name goals of yours");
      expect(ctx.t.graphql.calls("ReorderGoals")).toHaveLength(0);
    });
  });

  describe("goal milestones", () => {
    const MILESTONES = graphQlGoal().milestones;
    const THIRD = MILESTONES[2].id;
    const FIRST = MILESTONES[0].id;
    const ms = `${BASE}/goal/${GOAL_ID}/milestone`;
    const milestoneGoal = (type = "milestone", milestones = MILESTONES) =>
      ctx.t.graphql.on("DescribeGoalMilestones", {
        minerva_goals: [{ id: GOAL_ID, type, milestones }],
      });

    describe("CreateGoalMilestone", () => {
      const create = (body: object) =>
        ctx.as(
          ctx.t.http().post(`${BASE}/goal/${GOAL_ID}/milestones`).send(body),
        );

      it("adds a milestone at the end of the list", async () => {
        milestoneGoal();
        ctx.t.graphql.on("CreateGoalMilestone", {
          insert_minerva_goal_milestones_one: graphQlGoalMilestone({
            id: "8c3d0000-0000-4000-8000-000000000007",
            title: "Release notes",
            dueDate: null,
            position: 6,
            doneTime: null,
          }),
        });

        const res = await create({
          goalMilestone: { title: " Release notes " },
        });

        expect(res.status).toBe(201);
        expect(res.headers.location).toBeUndefined();
        expect(res.body.goalMilestone).toMatchObject({
          title: "Release notes",
          position: 6,
          done: false,
        });
        expect(
          ctx.t.graphql.calls("DescribeGoalMilestones")[0].variables,
        ).toEqual({ userId: USER, goalId: GOAL_ID });
        expect(ctx.t.graphql.calls("CreateGoalMilestone")[0].variables).toEqual(
          {
            object: {
              goalId: GOAL_ID,
              title: "Release notes",
              dueDate: null,
              weight: 1,
              position: 6,
            },
          },
        );
      });

      it("answers 400 for a goal that is not a milestone goal", async () => {
        milestoneGoal("outcome", []);

        const res = await create({ goalMilestone: { title: "Half way" } });

        expect(res.status).toBe(400);
        expect(ctx.t.graphql.calls("CreateGoalMilestone")).toHaveLength(0);
      });

      it.each([
        ["no milestone", {}, "goalMilestone is required"],
        [
          "a blank title",
          { goalMilestone: { title: "  " } },
          "goalMilestone.title must be 1 to 120 characters",
        ],
        [
          "a weight of nothing",
          { goalMilestone: { title: "Half way", weight: 0 } },
          "goalMilestone.weight must be a number above 0 and at most 1000",
        ],
      ])("answers 400 for %s, before Hasura", async (_, body, problem) => {
        const res = await create(body);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain(problem);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      });

      it("answers 404 for someone else's goal", async () => {
        ctx.t.graphql.on("DescribeGoalMilestones", { minerva_goals: [] });

        const res = await create({ goalMilestone: { title: "Half way" } });

        expect(res.status).toBe(404);
        expect(ctx.t.graphql.calls("CreateGoalMilestone")).toHaveLength(0);
      });
    });

    describe("UpdateGoalMilestone", () => {
      const update = (body: object, milestoneId = THIRD) =>
        ctx.as(ctx.t.http().put(`${ms}/${milestoneId}`).send(body));
      const returning = (overrides = {}) =>
        ctx.t.graphql.on("UpdateGoalMilestone", {
          update_minerva_goal_milestones: {
            returning: [{ ...MILESTONES[2], ...overrides }],
          },
        });

      it("ticks a milestone done, stamping the time", async () => {
        milestoneGoal();
        returning({ doneTime: "2026-10-01T19:00:00.000Z" });

        const res = await update({ goalMilestone: { done: true } });

        expect(res.status).toBe(200);
        expect(res.body.goalMilestone).toMatchObject({ id: THIRD, done: true });
        expect(ctx.t.graphql.calls("UpdateGoalMilestone")[0].variables).toEqual(
          {
            goalId: GOAL_ID,
            milestoneId: THIRD,
            set: { doneTime: "2026-10-01T19:00:00.000Z" },
          },
        );
      });

      it("unticks a done milestone and renames it", async () => {
        milestoneGoal();
        ctx.t.graphql.on("UpdateGoalMilestone", {
          update_minerva_goal_milestones: {
            returning: [{ ...MILESTONES[0], doneTime: null, title: "Schema" }],
          },
        });

        const res = await update(
          { goalMilestone: { done: false, title: "Schema" } },
          FIRST,
        );

        expect(res.status).toBe(200);
        expect(
          ctx.t.graphql.calls("UpdateGoalMilestone")[0].variables?.set,
        ).toEqual({ title: "Schema", doneTime: null });
      });

      it("answers 304 when the request names nothing to change", async () => {
        milestoneGoal();

        const res = await update({ goalMilestone: {} });

        expect(res.status).toBe(304);
        expect(ctx.t.graphql.calls("UpdateGoalMilestone")).toHaveLength(0);
      });

      it("answers the milestone as it stands when it already is so", async () => {
        milestoneGoal();

        const res = await update({ goalMilestone: { done: false, weight: 1 } });

        expect(res.status).toBe(200);
        expect(res.body.goalMilestone.id).toBe(THIRD);
        expect(ctx.t.graphql.calls("UpdateGoalMilestone")).toHaveLength(0);
      });

      it.each([
        [{ goalMilestone: { done: "yes" } }, "done must be true or false"],
        [
          { goalMilestone: { dueDate: "Friday" } },
          "dueDate must be a date written YYYY-MM-DD",
        ],
      ])("answers 400 for %j, before Hasura", async (body, problem) => {
        const res = await update(body);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain(problem);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      });

      it("answers 404 for a milestone of another goal", async () => {
        milestoneGoal();

        const res = await update(
          { goalMilestone: { done: true } },
          GOAL_MILESTONE_ID.replace(/1$/, "9"),
        );

        expect(res.status).toBe(404);
        expect(ctx.t.graphql.calls("UpdateGoalMilestone")).toHaveLength(0);
      });
    });

    describe("DeleteGoalMilestone", () => {
      const remove = () => ctx.as(ctx.t.http().delete(`${ms}/${THIRD}`));

      it("removes a milestone", async () => {
        milestoneGoal();
        ctx.t.graphql.on("DeleteGoalMilestone", {
          delete_minerva_goal_milestones: { affected_rows: 1 },
        });

        const res = await remove();

        expect(res.status).toBe(204);
        expect(ctx.t.graphql.calls("DeleteGoalMilestone")[0].variables).toEqual(
          { goalId: GOAL_ID, milestoneId: THIRD },
        );
      });

      it("answers 404 for a milestone that is not there", async () => {
        milestoneGoal();
        ctx.t.graphql.on("DeleteGoalMilestone", {
          delete_minerva_goal_milestones: { affected_rows: 0 },
        });

        expect((await remove()).status).toBe(404);
      });

      it("answers 404 for someone else's goal, deleting nothing", async () => {
        ctx.t.graphql.on("DescribeGoalMilestones", { minerva_goals: [] });

        expect((await remove()).status).toBe(404);
        expect(ctx.t.graphql.calls("DeleteGoalMilestone")).toHaveLength(0);
      });
    });

    describe("ReorderGoalMilestones", () => {
      const reorder = (body: object) =>
        ctx.as(
          ctx.t
            .http()
            .put(`${BASE}/goal/${GOAL_ID}/milestones/order`)
            .send(body),
        );
      const reversed = MILESTONES.map((m) => m.id).reverse();

      it("puts every milestone in the order given", async () => {
        let call = 0;
        ctx.t.graphql.on("DescribeGoalMilestones", () => ({
          minerva_goals: [
            {
              id: GOAL_ID,
              type: "milestone",
              milestones:
                call++ === 0
                  ? MILESTONES
                  : [...MILESTONES]
                      .reverse()
                      .map((m, position) => ({ ...m, position })),
            },
          ],
        }));
        ctx.t.graphql.on("ReorderGoalMilestones", {
          update_minerva_goal_milestones_many: [],
        });

        const res = await reorder({ milestoneIds: reversed });

        expect(res.status).toBe(200);
        expect(
          res.body.goalMilestones.map((m: { id: string }) => m.id),
        ).toEqual(reversed);
        const { updates } = ctx.t.graphql.calls("ReorderGoalMilestones")[0]
          .variables as { updates: unknown[] };
        expect(updates).toHaveLength(6);
        expect(updates[0]).toEqual({
          where: { id: { _eq: reversed[0] }, goalId: { _eq: GOAL_ID } },
          _set: { position: 0 },
        });
      });

      it("answers 400 unless every milestone is named exactly once", async () => {
        milestoneGoal();

        const res = await reorder({ milestoneIds: reversed.slice(1) });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(
          "milestoneIds must name each of the goal's milestones exactly once",
        );
        expect(ctx.t.graphql.calls("ReorderGoalMilestones")).toHaveLength(0);
      });

      it("answers 400 for a list that is not IDs, before Hasura", async () => {
        const res = await reorder({ milestoneIds: "all" });

        expect(res.status).toBe(400);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      });
    });
  });
});
