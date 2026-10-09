import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva/reviews/summary";
const PACIFIC = "America/Los_Angeles";
const WENT_WELL = "8c4f2e00-0000-4000-8000-000000000001";

/** A summary row: a completed daily review with the canvas's ratings. */
const row = (
  periodStart: string,
  [overall, mood, energy, focus]: number[],
  answers: { promptId: string; body: string }[] = [],
) => ({
  id: `7b3e1d00-0000-4000-8000-0000000${periodStart.replace(/-/g, "").substring(3)}`,
  periodStart,
  completedTime: `${periodStart}T23:00:00Z`,
  overall,
  mood,
  energy,
  focus,
  progress: null,
  balance: null,
  answers,
});

/**
 * GetReviewSummary over the real HTTP stack, at 23:30 on Thursday
 * 2026-10-01 in Seattle (06:30 on the 2nd in UTC).
 */
describe("Review summary API", () => {
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

  const summary = (query: string, tz = PACIFIC) =>
    ctx.as(ctx.t.http().get(`${BASE}?${query}`).set("x-ncfritz-tz", tz));

  it("answers 401 without an identity, asking Hasura nothing", async () => {
    const res = await ctx.t
      .http()
      .get(`${BASE}?kind=daily&from=2026-09-21&to=2026-09-27`);
    expect(res.status).toBe(401);
    expect(ctx.t.graphql.request).not.toHaveBeenCalled();
  });

  it("summarises week 39 from one read, Thursday missed", async () => {
    ctx.t.graphql.on("GetReviewSummary", {
      reviews: [
        row(
          "2026-09-21",
          [4, 4, 4, 4],
          [{ promptId: WENT_WELL, body: "Weather plan approved." }],
        ),
        row("2026-09-22", [3, 3, 3, 3]),
        row("2026-09-23", [2, 3, 2, 2]),
        row("2026-09-25", [4, 4, 3, 4]),
        row("2026-09-26", [5, 5, 4, 4]),
        row("2026-09-27", [4, 4, 4, 3]),
      ],
      prompts: [{ id: WENT_WELL }],
      completed: [
        { periodStart: "2026-09-30" },
        { periodStart: "2026-09-29" },
        { periodStart: "2026-09-27" },
      ],
    });

    const res = await summary("kind=daily&from=2026-09-21&to=2026-09-27");

    expect(res.status).toBe(200);
    const body = res.body.summary;
    expect(body.periods.map((p: { status: string }) => p.status)).toEqual([
      "complete",
      "complete",
      "complete",
      "missed",
      "complete",
      "complete",
      "complete",
    ]);
    expect(body.periods[0].headline).toBe("Weather plan approved.");
    expect(body).toMatchObject({
      kind: "daily",
      today: "2026-10-01",
      complete: 6,
      due: 7,
      currentStreak: 2,
      bestStreak: 3,
      averages: { overall: 3.67 },
    });
    expect(ctx.t.graphql.calls("GetReviewSummary")[0].variables).toEqual({
      userId: USER,
      kind: "daily",
      from: "2026-09-14",
      to: "2026-09-27",
      current: "2026-10-01",
      streak: 1000,
    });
  });

  it("takes today from the caller's timezone", async () => {
    ctx.t.graphql.on("GetReviewSummary", {
      reviews: [],
      prompts: [],
      completed: [],
    });

    const pacific = await summary("kind=daily&from=2026-10-01&to=2026-10-02");
    const utc = await summary(
      "kind=daily&from=2026-10-01&to=2026-10-02",
      "Etc/UTC",
    );

    expect(
      pacific.body.summary.periods.map((p: { status: string }) => p.status),
    ).toEqual(["open", "upcoming"]);
    expect(pacific.body.summary.today).toBe("2026-10-01");
    expect(
      utc.body.summary.periods.map((p: { status: string }) => p.status),
    ).toEqual(["missed", "open"]);
    expect(utc.body.summary.today).toBe("2026-10-02");
  });

  it("summarises weeks named by their Mondays", async () => {
    ctx.t.graphql.on("GetReviewSummary", {
      reviews: [],
      prompts: [],
      completed: [],
    });

    const res = await summary("kind=weekly&from=2026-08-31&to=2026-09-21");

    expect(res.status).toBe(200);
    expect(res.body.summary.periods).toHaveLength(4);
    expect(ctx.t.graphql.calls("GetReviewSummary")[0].variables).toMatchObject({
      from: "2026-08-03",
      current: "2026-09-28",
    });
  });

  it.each([
    ["no kind", "from=2026-09-21&to=2026-09-27"],
    ["a monthly kind", "kind=monthly&from=2026-09-21&to=2026-09-27"],
    ["no from", "kind=daily&to=2026-09-27"],
    ["a to before from", "kind=daily&from=2026-09-27&to=2026-09-21"],
    ["a range over 400 days", "kind=daily&from=2025-01-01&to=2026-09-27"],
    ["weeks from a Tuesday", "kind=weekly&from=2026-09-22&to=2026-09-28"],
  ])("answers 400 for %s, before Hasura", async (_, query) => {
    const res = await summary(query);
    expect(res.status).toBe(400);
    expect(ctx.t.graphql.request).not.toHaveBeenCalled();
  });

  it("answers 400 for a timezone it does not know", async () => {
    const res = await summary(
      "kind=daily&from=2026-09-21&to=2026-09-27",
      "Mars/Base",
    );
    expect(res.status).toBe(400);
  });
});
