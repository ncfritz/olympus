import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GOAL_CYCLE_ID,
  GOAL_HABIT_LOG_ID,
  GOAL_ID,
  graphQlGoal,
  graphQlGoalHabitLog,
} from "../../fixtures/minerva";
import { OTHER_USER, signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva";
const PACIFIC = "America/Los_Angeles";
const RUN = "9b1c0000-0000-4000-8000-0000000000c1";
const READ = "9b1c0000-0000-4000-8000-0000000000c2";
const STRETCH = "9b1c0000-0000-4000-8000-0000000000c3";
const DONE = "9b1c0000-0000-4000-8000-0000000000c4";

const rule = (overrides = {}) => ({
  frequency: "weekly",
  timesPerPeriod: 3,
  weekdays: null,
  quantityTarget: null,
  quantityUnit: null,
  createdTime: "2026-09-14T12:00:00Z",
  lastUpdatedTime: null,
  ...overrides,
});

/** A habit goal row for ListGoals, its logs as the engine reads them. */
const habit = (
  id: string,
  logged: string[],
  overrides: Record<string, unknown> = {},
) =>
  graphQlGoal({
    id,
    title: id,
    type: "habit",
    horizon: "ongoing",
    cycleId: null,
    startDate: "2026-09-14",
    dueDate: null,
    progressMode: "habit",
    milestones: [],
    goalTags: [],
    habitRule: rule(),
    habitLogs: logged.map((logDate) => ({
      logDate,
      done: true,
      quantity: null,
    })),
    ...overrides,
  });

/**
 * Habit logs, the day's habits and execution over the real HTTP stack, on
 * Thursday Oct 1 2026 at noon in Seattle. Hasura is a test double.
 */
describe("Goal habits API", () => {
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
  /** Moves the clock and signs in again, so the token is valid then. */
  const at = async (iso: string) => {
    vi.setSystemTime(new Date(iso));
    await ctx.signInAs(USER);
  };

  /** The habit goal the log operations read, with every log oldest first. */
  const target = (
    overrides: Record<string, unknown> = {},
    logs: unknown[] = [],
  ) =>
    ctx.t.graphql.on("ListGoalHabitLogs", {
      minerva_goals: [
        {
          id: GOAL_ID,
          type: "habit",
          status: "active",
          startDate: "2026-09-14",
          dueDate: null,
          closedOn: null,
          habitRule: rule(),
          habitLogs: logs,
          ...overrides,
        },
      ],
    });

  describe("without an identity", () => {
    it.each([
      ["put", `${BASE}/goal/${GOAL_ID}/habit/today`],
      ["delete", `${BASE}/goal/${GOAL_ID}/habit/today`],
      ["get", `${BASE}/goal/${GOAL_ID}/habit`],
      ["get", `${BASE}/goals/habits/today`],
      ["get", `${BASE}/goals/execution`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await ctx.t.http()[method](path);
        expect(res.status).toBe(401);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("LogGoalHabit", () => {
    const log = (date: string, body?: object, tz = PACIFIC) => {
      const req = ctx.t
        .http()
        .put(`${BASE}/goal/${GOAL_ID}/habit/${date}`)
        .set("x-ncfritz-tz", tz);
      return ctx.as(body === undefined ? req : req.send(body));
    };
    const saved = () =>
      ctx.t.graphql.on("LogGoalHabit", (variables) => ({
        insert_minerva_goal_habit_logs_one: graphQlGoalHabitLog(
          (variables as { object: object }).object,
        ),
      }));
    const object = () =>
      (
        ctx.t.graphql.calls("LogGoalHabit")[0]?.variables as
          { object: Record<string, unknown> } | undefined
      )?.object;

    it("marks today done with no body, as an upsert on the day", async () => {
      target();
      saved();

      const res = await log("today");

      expect(res.status).toBe(200);
      expect(res.body.goalHabitLog).toMatchObject({
        logDate: "2026-10-01",
        done: true,
        met: true,
      });
      expect(object()).toEqual({
        goalId: GOAL_ID,
        logDate: "2026-10-01",
        done: true,
        quantity: null,
        note: null,
      });
      expect(ctx.t.graphql.calls("LogGoalHabit")[0].document).toMatch(
        /constraint: goal_habit_logs_goal_id_log_date_key/,
      );
      expect(ctx.t.graphql.calls("ListGoalHabitLogs")[0].variables).toEqual({
        userId: USER,
        goalId: GOAL_ID,
      });
    });

    it.each([
      [PACIFIC, "2026-10-01"],
      ["Etc/UTC", "2026-10-02"],
    ])("takes today in %s", async (tz, date) => {
      // 18:00 on Oct 1 in Seattle is already Oct 2 in UTC.
      await at("2026-10-02T01:00:00Z");
      target();
      saved();

      const res = await log("today", undefined, tz);

      expect(res.status).toBe(200);
      expect(object()?.logDate).toBe(date);
    });

    it.each([
      [35, true],
      [20, false],
    ])(
      "records a quantity of %i, met against a target of 30: %s",
      async (quantity, met) => {
        target({
          habitRule: rule({
            frequency: "daily",
            timesPerPeriod: 1,
            quantityTarget: 30,
            quantityUnit: "min",
          }),
        });
        saved();

        const res = await log("2026-09-30", {
          goalHabitLog: { quantity, note: "Lunch run" },
        });

        expect(res.status).toBe(200);
        expect(object()).toMatchObject({
          done: false,
          quantity,
          note: "Lunch run",
        });
        expect(res.body.goalHabitLog).toMatchObject({ quantity, met });
      },
    );

    it.each([
      [
        "tomorrow",
        "2026-10-02",
        undefined,
        "date must not be after today, 2026-10-01",
      ],
      [
        "a day that is not a date",
        "yesterday",
        undefined,
        "date must be a date written YYYY-MM-DD",
      ],
      [
        "a log that records nothing",
        "today",
        { goalHabitLog: { done: false } },
        "a log records done or a quantity; delete the day's log to clear it",
      ],
      [
        "a negative quantity",
        "today",
        { goalHabitLog: { quantity: -1 } },
        "quantity must be a number",
      ],
      [
        "done that is not true or false",
        "today",
        { goalHabitLog: { done: "yes" } },
        "done must be true or false",
      ],
    ])("answers 400 for %s, before Hasura", async (_, date, body, problem) => {
      const res = await log(date, body);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(problem);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it.each([
      [
        "a day before the goal starts",
        {},
        "2026-09-13",
        "date must not be before the goal starts, 2026-09-14",
      ],
      [
        "a day after the goal closed",
        { status: "missed", closedOn: "2026-09-29" },
        "2026-09-30",
        "date must not be after the goal closed, 2026-09-29",
      ],
      [
        "a goal that is not a habit",
        { type: "milestone", habitRule: null },
        "today",
        "only habit goals have logs",
      ],
    ])(
      "answers 400 for %s, logging nothing",
      async (_, goal, date, problem) => {
        target(goal);

        const res = await log(date);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain(problem);
        expect(object()).toBeUndefined();
      },
    );

    it("answers 404 for someone else's goal", async () => {
      ctx.t.graphql.on("ListGoalHabitLogs", { minerva_goals: [] });
      await ctx.signInAs(OTHER_USER);

      const res = await log("today");

      expect(res.status).toBe(404);
      expect(object()).toBeUndefined();
    });
  });

  describe("DeleteGoalHabitLog", () => {
    const remove = (date = "2026-09-28") =>
      ctx.as(
        pacific(ctx.t.http().delete(`${BASE}/goal/${GOAL_ID}/habit/${date}`)),
      );

    it("clears a day's log", async () => {
      target();
      ctx.t.graphql.on("DeleteGoalHabitLog", {
        delete_minerva_goal_habit_logs: { affected_rows: 1 },
      });

      const res = await remove();

      expect(res.status).toBe(204);
      expect(ctx.t.graphql.calls("DeleteGoalHabitLog")[0].variables).toEqual({
        goalId: GOAL_ID,
        logDate: "2026-09-28",
      });
    });

    it("answers 404 for a day with no log", async () => {
      target();
      ctx.t.graphql.on("DeleteGoalHabitLog", {
        delete_minerva_goal_habit_logs: { affected_rows: 0 },
      });

      expect((await remove()).status).toBe(404);
    });

    it("answers 400 for a day that is not a date, before Hasura", async () => {
      expect((await remove("Monday")).status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("ListGoalHabitLogs", () => {
    const list = (query = "") =>
      ctx.as(
        pacific(ctx.t.http().get(`${BASE}/goal/${GOAL_ID}/habit${query}`)),
      );
    const RUNS = [
      "2026-09-14",
      "2026-09-16",
      "2026-09-18",
      "2026-09-22",
      "2026-09-24",
      "2026-09-29",
    ];
    const logs = RUNS.map((logDate, i) =>
      graphQlGoalHabitLog({
        id: `3a5f0000-0000-4000-8000-00000000000${i + 1}`,
        logDate,
      }),
    );

    it("lists the last twelve weeks of logs with adherence and streaks", async () => {
      target({}, logs);

      const res = await list();

      expect(res.status).toBe(200);
      expect(
        res.body.goalHabitLogs.map((l: { logDate: string }) => l.logDate),
      ).toEqual(RUNS);
      expect(res.body.goalHabitLogs[0]).toMatchObject({
        id: GOAL_HABIT_LOG_ID,
        done: true,
        met: true,
      });
      // Three runs, then two, then one so far this week: 6 of 7 due.
      expect(res.body.summary).toEqual({
        adherence: 85.7,
        done: 6,
        due: 7,
        currentStreak: 0,
        bestStreak: 1,
        periodDone: 1,
        periodCapacity: 3,
      });
    });

    it("keeps to the days asked for, the summary still as of today", async () => {
      target({}, logs);

      const res = await list("?from=2026-09-20&to=2026-09-27");

      expect(
        res.body.goalHabitLogs.map((l: { logDate: string }) => l.logDate),
      ).toEqual(["2026-09-22", "2026-09-24"]);
      expect(res.body.summary.done).toBe(6);
    });

    it.each([
      // Closed on a Sunday: its last week is over, 5 runs of 6.
      ["2026-09-27", { done: 5, due: 6, adherence: 83.3, periodCapacity: 3 }],
      // Closed on a Wednesday: that week counts only as far as done.
      ["2026-09-23", { done: 4, due: 4, adherence: 100, periodDone: 1 }],
    ])(
      "measures a habit closed on %s as of that day",
      async (closedOn, summary) => {
        target({ status: "dropped", closedOn }, logs);

        const res = await list();

        expect(res.body.summary).toMatchObject(summary);
      },
    );

    it("measures a habit past its due date as of that day", async () => {
      target({ dueDate: "2026-09-27" }, logs);

      const res = await list();

      expect(res.body.summary).toMatchObject({ done: 5, due: 6 });
    });

    it.each([
      ["?from=2026-09-28&to=2026-09-01", "from must not be after to"],
      ["?from=last-week", "from must be a date written YYYY-MM-DD"],
    ])("answers 400 for %s, before Hasura", async (query, problem) => {
      const res = await list(query);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(problem);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("ListGoalHabitsForDay", () => {
    const day = (date = "today", tz = PACIFIC) =>
      ctx.as(
        ctx.t
          .http()
          .get(`${BASE}/goals/habits/${date}`)
          .set("x-ncfritz-tz", tz),
      );
    const dayLogs = (...logs: unknown[]) =>
      ctx.t.graphql.on("ListGoalHabitsForDay", {
        minerva_goal_habit_logs: logs,
      });
    const titles = (body: { habits: { goal: { title: string } }[] }) =>
      body.habits.map((h) => h.goal.title);

    it("lists the habits due today by their rules", async () => {
      ctx.t.graphql.on("ListGoals", {
        minerva_goals: [
          // Twice this week of three: still due.
          habit(RUN, ["2026-09-28", "2026-09-30"], { position: 0 }),
          // Daily, and done today: shown with its log.
          habit(READ, ["2026-10-01"], {
            habitRule: rule({ frequency: "daily", timesPerPeriod: 1 }),
            position: 1,
          }),
          // Mondays, Wednesdays and Fridays: not a Thursday.
          habit(STRETCH, [], {
            habitRule: rule({
              frequency: "weekdays",
              timesPerPeriod: 1,
              weekdays: 21,
            }),
            position: 2,
          }),
          // Three of three this week already, none today: done for the week.
          habit(DONE, ["2026-09-28", "2026-09-29", "2026-09-30"], {
            position: 3,
          }),
          habit("paused", [], {
            id: "9b1c0000-0000-4000-8000-0000000000c5",
            status: "paused",
          }),
          habit("later", [], {
            id: "9b1c0000-0000-4000-8000-0000000000c6",
            startDate: "2026-10-02",
          }),
          habit("deleted", [], {
            id: "9b1c0000-0000-4000-8000-0000000000c7",
            deletedTime: "2026-09-30T12:00:00Z",
          }),
          graphQlGoal(),
        ],
      });
      dayLogs(graphQlGoalHabitLog({ goalId: READ, logDate: "2026-10-01" }));

      const res = await day();

      expect(res.status).toBe(200);
      expect(res.body.date).toBe("2026-10-01");
      expect(titles(res.body)).toEqual([RUN, READ]);
      expect(res.body.habits[0]).toMatchObject({
        periodDone: 2,
        periodCapacity: 3,
      });
      expect(res.body.habits[0].log).toBeUndefined();
      expect(res.body.habits[1]).toMatchObject({
        periodDone: 1,
        periodCapacity: 1,
        log: { logDate: "2026-10-01", met: true },
      });
      expect(ctx.t.graphql.calls("ListGoalHabitsForDay")[0].variables).toEqual({
        userId: USER,
        logDate: "2026-10-01",
      });
    });

    it("keeps a habit met today on the strip, with its log", async () => {
      ctx.t.graphql.on("ListGoals", {
        minerva_goals: [
          habit(DONE, ["2026-09-28", "2026-09-29", "2026-10-01"]),
        ],
      });
      dayLogs(graphQlGoalHabitLog({ goalId: DONE, logDate: "2026-10-01" }));

      const res = await day();

      expect(titles(res.body)).toEqual([DONE]);
      expect(res.body.habits[0]).toMatchObject({
        periodDone: 3,
        periodCapacity: 3,
      });
    });

    it.each([
      [PACIFIC, "2026-10-04", [RUN]],
      ["Etc/UTC", "2026-10-05", [RUN, STRETCH]],
    ])(
      "at 18:00 on Sunday in Seattle, today in %s is %s",
      async (tz, date, due) => {
        await at("2026-10-05T01:00:00Z");
        ctx.t.graphql.on("ListGoals", {
          minerva_goals: [
            habit(RUN, ["2026-09-28"], { position: 0 }),
            habit(STRETCH, [], {
              habitRule: rule({
                frequency: "weekdays",
                timesPerPeriod: 1,
                weekdays: 21,
              }),
              position: 1,
            }),
          ],
        });
        dayLogs();

        const res = await day("today", tz);

        expect(res.body.date).toBe(date);
        expect(titles(res.body)).toEqual(due);
      },
    );

    it("answers 400 for a day after today, before Hasura", async () => {
      const res = await day("2026-10-02");

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("GetGoalExecution", () => {
    const execution = (query = "", tz = PACIFIC) =>
      ctx.as(
        ctx.t
          .http()
          .get(`${BASE}/goals/execution${query}`)
          .set("x-ncfritz-tz", tz),
      );
    const goals = (...rows: unknown[]) =>
      ctx.t.graphql.on("ListGoals", { minerva_goals: rows });

    it("scores this week by default: done over due, up to today", async () => {
      goals(
        habit(RUN, ["2026-09-28", "2026-09-30"]),
        habit(READ, ["2026-09-28", "2026-09-29", "2026-10-01"], {
          habitRule: rule({ frequency: "daily", timesPerPeriod: 1 }),
        }),
        graphQlGoal(),
      );

      const res = await execution();

      expect(res.status).toBe(200);
      // Reading: Mon and Tue done, Wed missed, today done. Running: the
      // week is still going, so its two runs are all that is due yet.
      expect(res.body.execution).toMatchObject({
        from: "2026-09-28",
        to: "2026-10-04",
        done: 5,
        due: 6,
        score: 83.3,
        goals: [
          { goalId: RUN, done: 2, due: 2, score: 100 },
          { goalId: READ, done: 3, due: 4, score: 75 },
        ],
      });
      expect(
        res.body.execution.days.map((d: { date: string }) => d.date),
      ).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]);
    });

    it("scores an ISO week asked for", async () => {
      goals(habit(RUN, ["2026-09-22", "2026-09-24"]));

      const res = await execution("?week=2026-W39");

      expect(res.body.execution).toMatchObject({
        from: "2026-09-21",
        to: "2026-09-27",
        done: 2,
        due: 3,
        score: 66.7,
      });
    });

    it("scores a cycle's execution weeks", async () => {
      goals(habit(RUN, ["2026-09-14", "2026-09-16", "2026-09-18"]));
      ctx.t.graphql.on("GetGoalExecution", {
        minerva_goal_cycles: [
          { startDate: "2026-09-07", weeks: 12, bufferWeeks: 1 },
        ],
      });

      const res = await execution(`?cycleId=${GOAL_CYCLE_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.execution).toMatchObject({
        from: "2026-09-07",
        to: "2026-11-29",
        done: 3,
        due: 6,
        score: 50,
      });
      expect(ctx.t.graphql.calls("GetGoalExecution")[0].variables).toEqual({
        userId: USER,
        cycleId: GOAL_CYCLE_ID,
      });
    });

    it.each([
      [PACIFIC, { done: 2, due: 2, score: 100 }],
      ["Etc/UTC", { done: 2, due: 3, score: 66.7 }],
    ])("at 18:00 on Sunday in Seattle, W40 seen from %s", async (tz, score) => {
      await at("2026-10-05T01:00:00Z");
      goals(habit(RUN, ["2026-09-28", "2026-10-01"]));

      const res = await execution("?week=2026-W40", tz);

      expect(res.body.execution).toMatchObject(score);
    });

    it.each([
      [
        `?week=2026-W40&cycleId=${GOAL_CYCLE_ID}`,
        "give a week or a cycleId, not both",
      ],
      [
        "?week=2026-40",
        "week must be an ISO week written YYYY-Www, e.g. 2026-W40",
      ],
      ["?cycleId=four", "cycleId must be an ID"],
    ])("answers 400 for %s, before Hasura", async (query, problem) => {
      const res = await execution(query);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(problem);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it("answers 404 for someone else's cycle", async () => {
      ctx.t.graphql.on("GetGoalExecution", { minerva_goal_cycles: [] });

      const res = await execution(`?cycleId=${GOAL_CYCLE_ID}`);

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("ListGoals")).toHaveLength(0);
    });
  });
});
