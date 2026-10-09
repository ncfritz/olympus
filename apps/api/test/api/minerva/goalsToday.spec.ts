import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  graphQlGoal,
  graphQlGoalHabitLog,
  graphQlGoalMilestone,
} from "../../fixtures/minerva";
import { signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva";
const PACIFIC = "America/Los_Angeles";

/** A goal ID from a short number, so each row is told apart. */
const id = (n: number) =>
  `9b1d0000-0000-4000-8000-${String(n).padStart(12, "0")}`;

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

const habit = (
  n: number,
  logged: string[],
  overrides: Record<string, unknown> = {},
) =>
  graphQlGoal({
    id: id(n),
    title: `habit ${n}`,
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
    position: n,
    ...overrides,
  });

const checkin = (checkinDate: string, confidence: string | null = null) => ({
  checkinDate,
  value: null,
  confidence,
  createdTime: `${checkinDate}T18:00:00Z`,
});

const goal = (
  n: number,
  type: "outcome" | "achievement" | "milestone",
  overrides: Record<string, unknown> = {},
) =>
  graphQlGoal({
    id: id(n),
    title: `${type} ${n}`,
    type,
    progressMode:
      type === "outcome"
        ? "checkins"
        : type === "achievement"
          ? "status"
          : "milestones",
    unit: type === "outcome" ? "books" : null,
    startValue: type === "outcome" ? 0 : null,
    targetValue: type === "outcome" ? 24 : null,
    milestones: type === "milestone" ? graphQlGoal().milestones : [],
    goalTags: [],
    position: n,
    ...overrides,
  });

/**
 * The home widget's list of what is left today, over the real HTTP stack,
 * on Thursday Oct 1 2026 at noon in Seattle. Hasura is a test double.
 */
describe("ListGoalsForToday", () => {
  const ctx = signedInApp();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T19:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const today = (tz = PACIFIC) =>
    ctx.as(ctx.t.http().get(`${BASE}/goals/today`).set("x-ncfritz-tz", tz));
  const rows = (...goals: unknown[]) =>
    ctx.t.graphql.on("ListGoals", { minerva_goals: goals });
  const dayLogs = (...logs: unknown[]) =>
    ctx.t.graphql.on("ListGoalHabitsForDay", {
      minerva_goal_habit_logs: logs,
    });
  const titles = (list: { title: string }[]) => list.map((g) => g.title);

  it("answers 401 without an identity and asks Hasura nothing", async () => {
    const res = await ctx.t.http().get(`${BASE}/goals/today`);
    expect(res.status).toBe(401);
    expect(ctx.t.graphql.request).not.toHaveBeenCalled();
  });

  it("lists what is left by type, and what is done today", async () => {
    rows(
      // Weekly, two of three: left, after the daily ones.
      habit(1, ["2026-09-28", "2026-09-30"]),
      // Daily and met today: done.
      habit(2, ["2026-10-01"], {
        habitRule: rule({ frequency: "daily", timesPerPeriod: 1 }),
      }),
      // Daily, not yet today: left, first.
      habit(3, [], {
        habitRule: rule({ frequency: "daily", timesPerPeriod: 1 }),
      }),
      // Three of three this week: neither left nor done today.
      habit(4, ["2026-09-28", "2026-09-29", "2026-09-30"]),
      // Its next milestone is the third.
      goal(5, "milestone"),
      // A milestone ticked this morning: done.
      goal(6, "milestone", {
        milestones: [
          graphQlGoalMilestone({
            id: id(61),
            goalId: id(6),
            doneTime: "2026-10-01T16:00:00Z",
          }),
          graphQlGoalMilestone({
            id: id(62),
            goalId: id(6),
            position: 1,
            doneTime: null,
          }),
        ],
      }),
      // Set by hand: left, with no next milestone.
      goal(7, "milestone", { progressMode: "manual", manualProgress: 40 }),
      // Checked in on today: done.
      goal(8, "outcome", { checkins: [checkin("2026-10-01")] }),
      // Last checked in on Monday: left.
      goal(9, "outcome", { checkins: [checkin("2026-09-28")] }),
      goal(10, "achievement"),
      // Not counted at all.
      goal(11, "outcome", { status: "paused" }),
      goal(12, "outcome", { startDate: "2026-10-05" }),
      goal(13, "outcome", { deletedTime: "2026-09-30T12:00:00Z" }),
      goal(14, "achievement", { status: "achieved", closedOn: "2026-09-30" }),
    );
    dayLogs(graphQlGoalHabitLog({ goalId: id(2), logDate: "2026-10-01" }));

    const res = await today();

    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2026-10-01");
    expect(
      res.body.habits.map((h: { goal: { title: string } }) => h.goal.title),
    ).toEqual(["habit 3", "habit 1"]);
    expect(res.body.habits[1]).toMatchObject({
      periodDone: 2,
      periodCapacity: 3,
    });
    expect(
      res.body.milestones.map(
        (m: { goal: { title: string }; milestone?: { title: string } }) => [
          m.goal.title,
          m.milestone?.title,
        ],
      ),
    ).toEqual([
      ["milestone 5", "Goals home and goal page"],
      ["milestone 7", undefined],
    ]);
    expect(titles(res.body.outcomes)).toEqual(["outcome 9"]);
    expect(titles(res.body.achievements)).toEqual(["achievement 10"]);
    expect(titles(res.body.done)).toEqual([
      "habit 2",
      "milestone 6",
      "outcome 8",
    ]);
    expect(res.body.active).toEqual({
      habit: 4,
      milestone: 3,
      outcome: 2,
      achievement: 1,
    });
    expect(ctx.t.graphql.calls("ListGoalHabitsForDay")[0].variables).toEqual({
      userId: USER,
      logDate: "2026-10-01",
    });
  });

  it("puts a goal asking for a decision first, then the soonest due", async () => {
    rows(
      goal(1, "achievement", { dueDate: "2026-12-12" }),
      goal(2, "achievement", { dueDate: "2026-10-31" }),
      goal(3, "achievement", {
        dueDate: "2027-03-01",
        checkins: [
          checkin("2026-09-10", "off_track"),
          checkin("2026-09-17", "off_track"),
          checkin("2026-09-24", "off_track"),
        ],
      }),
    );
    dayLogs();

    const res = await today();

    expect(res.status).toBe(200);
    expect(titles(res.body.achievements)).toEqual([
      "achievement 3",
      "achievement 2",
      "achievement 1",
    ]);
    expect(res.body.achievements[0].needsDecision).toBe(true);
  });

  it("decides today in the caller's timezone", async () => {
    // 10 pm on Oct 1 in Seattle, already Oct 2 in UTC; the milestone was
    // ticked at 1 pm Seattle time, Oct 1 in both.
    vi.setSystemTime(new Date("2026-10-02T05:00:00Z"));
    await ctx.signInAs(USER);
    const ticked = goal(1, "milestone", {
      milestones: [
        graphQlGoalMilestone({
          id: id(11),
          goalId: id(1),
          doneTime: "2026-10-01T20:00:00Z",
        }),
        graphQlGoalMilestone({
          id: id(12),
          goalId: id(1),
          position: 1,
          doneTime: null,
        }),
      ],
    });
    rows(ticked);
    dayLogs();
    const pacific = await today();
    expect(pacific.body.date).toBe("2026-10-01");
    expect(titles(pacific.body.done)).toEqual(["milestone 1"]);
    expect(pacific.body.milestones).toEqual([]);

    rows(ticked);
    dayLogs();
    const utc = await today("Etc/UTC");
    expect(utc.body.date).toBe("2026-10-02");
    expect(utc.body.done).toEqual([]);
    expect(utc.body.milestones).toHaveLength(1);
  });
});
