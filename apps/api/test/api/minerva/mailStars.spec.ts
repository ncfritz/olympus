import { describe, expect, it } from "vitest";
import { signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva/mail/star-mismatches";
const ACCOUNT_ID = "7b2b0000-0000-4000-8000-000000000001";

/* Synthetic mail (never real). */
const row = (overrides: Record<string, unknown> = {}) => ({
  accountId: ACCOUNT_ID,
  gmailId: "1a",
  receivedTime: "2026-10-01T08:00:00+00:00",
  label: "Bills/*Payable",
  stateOpen: true,
  starred: false,
  starIcon: null,
  fix: "star",
  account: { attentionStar: "red-bang", doneStar: "green-check" },
  message: { fromAddress: "billing@power.example", subject: "Your bill" },
  ...overrides,
});

const count = (n: number) => ({ aggregate: { count: n } });

/** Stars as states (docs/plans/email-management phase 7 step 1). */
describe("Mail star mismatches", () => {
  const ctx = signedInApp();

  const answer = () =>
    ctx.t.graphql.on("ListMailStarMismatches", {
      minerva_mail_star_mismatches: [
        row(),
        row({
          gmailId: "2b",
          label: "Bills/*Paid",
          stateOpen: false,
          starred: true,
          starIcon: "red-bang",
          fix: "done-icon",
        }),
      ],
      matching: count(2),
      star: count(1),
      attentionIcon: count(0),
      doneIcon: count(1),
    });

  it("lists the caller's, each with the star its state wants", async () => {
    answer();
    const res = await ctx.as(ctx.t.http().get(BASE));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      mismatches: [
        {
          accountId: ACCOUNT_ID,
          gmailId: "1a",
          fromAddress: "billing@power.example",
          subject: "Your bill",
          receivedTime: "2026-10-01T08:00:00.000Z",
          label: "Bills/*Payable",
          stateOpen: true,
          starred: false,
          fix: "star",
          wanted: "red-bang",
        },
        expect.objectContaining({
          gmailId: "2b",
          starIcon: "red-bang",
          fix: "done-icon",
          wanted: "green-check",
        }),
      ],
      count: 2,
      counts: { star: 1, attentionIcon: 0, doneIcon: 1 },
    });
    expect(ctx.t.graphql.calls("ListMailStarMismatches")[0].variables).toEqual({
      where: { account: { userId: { _eq: USER } } },
      base: { account: { userId: { _eq: USER } } },
      offset: 0,
      limit: 100,
    });
  });

  it("filters by account and fix, and pages", async () => {
    answer();
    const res = await ctx.as(
      ctx.t
        .http()
        .get(`${BASE}?accountId=${ACCOUNT_ID}&fix=star&offset=100&limit=50`),
    );
    expect(res.status).toBe(200);
    const base = {
      account: { userId: { _eq: USER } },
      accountId: { _eq: ACCOUNT_ID },
    };
    expect(ctx.t.graphql.calls("ListMailStarMismatches")[0].variables).toEqual({
      where: { ...base, fix: { _eq: "star" } },
      base,
      offset: 100,
      limit: 50,
    });
  });

  it.each([
    "fix=sparkle",
    "accountId=7b2b",
    "limit=0",
    "limit=501",
    "offset=-1",
  ])("answers 400 to %s, before Hasura", async (query) => {
    const res = await ctx.as(ctx.t.http().get(`${BASE}?${query}`));
    expect(res.status).toBe(400);
    expect(ctx.t.graphql.calls("ListMailStarMismatches")).toHaveLength(0);
  });

  it("answers 401 without a token", async () => {
    const res = await ctx.t.http().get(BASE);
    expect(res.status).toBe(401);
  });
});
