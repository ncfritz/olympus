import { beforeEach, describe, expect, it, vi } from "vitest";
import { MailChangeService } from "../../../src/minerva/mail/services/MailChangeService";
import { OTHER_USER, signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva/mail";
const ACCOUNT_ID = "7b2b0000-0000-4000-8000-000000000001";

/* Synthetic mail (never real). */
const match = (overrides: Record<string, unknown> = {}) => ({
  accountId: ACCOUNT_ID,
  confirmationGmailId: "d1",
  confirmedTime: "2026-10-05T08:00:00+00:00",
  billGmailId: "b1",
  billReceivedTime: "2026-09-25T08:00:00+00:00",
  fromLabel: "Bills/*Payable",
  toLabel: "Bills/*Paid",
  billStarred: true,
  matchedBy: "wording",
  bill: { subject: "Your bill", fromAddress: "billing@power.example" },
  ...overrides,
});

const changes = { apply: vi.fn() };

const count = (n: number) => ({ aggregate: { count: n } });

/** Transitions from payments (docs/plans/email-management phase 7 step 2). */
describe("Mail payments", () => {
  const ctx = signedInApp({
    overrides: [{ provide: MailChangeService, useValue: changes }],
  });

  beforeEach(() => {
    changes.apply.mockReset();
    changes.apply.mockResolvedValue({ id: "batch-1", messages: 1 });
  });

  describe("ListMailPaymentMatches", () => {
    it("lists the caller's matches with each bill", async () => {
      ctx.t.graphql.on("ListMailPaymentMatches", {
        minerva_mail_payment_matches: [match()],
        count: count(1),
      });
      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/payment-matches?inInbox=true&limit=20`),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        matches: [
          {
            accountId: ACCOUNT_ID,
            confirmationGmailId: "d1",
            confirmedTime: "2026-10-05T08:00:00.000Z",
            billGmailId: "b1",
            billSubject: "Your bill",
            billFromAddress: "billing@power.example",
            billReceivedTime: "2026-09-25T08:00:00.000Z",
            fromLabel: "Bills/*Payable",
            toLabel: "Bills/*Paid",
            billStarred: true,
            matchedBy: "wording",
          },
        ],
        count: 1,
      });
      expect(
        ctx.t.graphql.calls("ListMailPaymentMatches")[0].variables,
      ).toEqual({
        where: {
          account: { userId: { _eq: USER } },
          confirmationInInbox: { _eq: true },
        },
        offset: 0,
        limit: 20,
      });
    });

    it.each(["inInbox=maybe", "accountId=7b2b", "limit=501"])(
      "answers 400 to %s",
      async (query) => {
        const res = await ctx.as(
          ctx.t.http().get(`${BASE}/payment-matches?${query}`),
        );
        expect(res.status).toBe(400);
        expect(ctx.t.graphql.calls("ListMailPaymentMatches")).toHaveLength(0);
      },
    );
  });

  describe("ListMailOpenBills", () => {
    it("lists open bills oldest first, with their ages", async () => {
      ctx.t.graphql.on("ListMailOpenBills", {
        minerva_mail_open_states: [
          {
            accountId: ACCOUNT_ID,
            gmailId: "b0",
            receivedTime: "2026-06-01T08:00:00+00:00",
            label: "Bills/*Payable",
            toLabel: "Bills/*Paid",
            starred: true,
            starIcon: "red-bang",
            message: {
              subject: "Old bill",
              fromAddress: "billing@water.example",
            },
          },
          {
            accountId: ACCOUNT_ID,
            gmailId: "x1",
            receivedTime: "2026-10-01T08:00:00+00:00",
            label: "Chores/*To do",
            toLabel: null,
            starred: false,
            starIcon: null,
            message: { subject: null, fromAddress: null },
          },
        ],
        count: count(9),
        month: count(4),
        older: count(2),
      });
      const res = await ctx.as(ctx.t.http().get(`${BASE}/open-bills`));
      expect(res.status).toBe(200);
      expect(res.body.ages).toEqual({ month: 4, quarter: 3, older: 2 });
      expect(res.body.count).toBe(9);
      expect(res.body.bills).toEqual([
        {
          accountId: ACCOUNT_ID,
          gmailId: "b0",
          fromAddress: "billing@water.example",
          subject: "Old bill",
          receivedTime: "2026-06-01T08:00:00.000Z",
          label: "Bills/*Payable",
          toLabel: "Bills/*Paid",
          starred: true,
          starIcon: "red-bang",
        },
        {
          accountId: ACCOUNT_ID,
          gmailId: "x1",
          receivedTime: "2026-10-01T08:00:00.000Z",
          label: "Chores/*To do",
          starred: false,
        },
      ]);
      const vars = ctx.t.graphql.calls("ListMailOpenBills")[0].variables as {
        base: unknown;
        offset: number;
        limit: number;
      };
      expect(vars.base).toEqual({ account: { userId: { _eq: USER } } });
      expect([vars.offset, vars.limit]).toEqual([0, 50]);
    });
  });

  describe("DismissMailPaymentMatches", () => {
    const DISMISS = `${BASE}/account/${ACCOUNT_ID}/payment-matches/dismiss`;

    it("records the pairs the account has", async () => {
      ctx.t.graphql.on("DescribeMailPaymentMessages", (vars) => ({
        minerva_mail_accounts:
          (vars as { userId: string }).userId === USER
            ? [
                {
                  id: ACCOUNT_ID,
                  messages: [
                    { id: "m-d1", gmailId: "d1" },
                    { id: "m-b1", gmailId: "b1" },
                  ],
                },
              ]
            : [],
      }));
      ctx.t.graphql.on("DismissMailPaymentMatches", {
        insert_minerva_mail_payment_dismissals: { affected_rows: 1 },
      });
      const res = await ctx.as(
        ctx.t
          .http()
          .post(DISMISS)
          .send({
            pairs: [
              { confirmationGmailId: "d1", billGmailId: "b1" },
              { confirmationGmailId: "d1", billGmailId: "ff" },
            ],
          }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ dismissed: 1 });
      expect(
        ctx.t.graphql.calls("DismissMailPaymentMatches")[0].variables,
      ).toEqual({ rows: [{ confirmationId: "m-d1", billId: "m-b1" }] });

      await ctx.signInAs(OTHER_USER);
      const other = await ctx.as(
        ctx.t
          .http()
          .post(DISMISS)
          .send({ pairs: [{ confirmationGmailId: "d1", billGmailId: "b1" }] }),
      );
      expect(other.status).toBe(404);
    });

    it.each([
      ["no pairs", { pairs: [] }],
      [
        "an ID that is not Gmail's",
        { pairs: [{ confirmationGmailId: "NOT", billGmailId: "b1" }] },
      ],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await ctx.as(ctx.t.http().post(DISMISS).send(body));
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("DescribeMailPaymentMessages")).toHaveLength(
        0,
      );
    });
  });

  describe("AcceptMailPaymentMatches", () => {
    const ACCEPT = `${BASE}/account/${ACCOUNT_ID}/payment-matches/accept`;

    it("moves each bill still matched, in one batch, and keeps the match", async () => {
      ctx.t.graphql.on("DescribeMailPaymentAcceptance", (vars) => ({
        minerva_mail_accounts:
          (vars as { userId: string }).userId === USER
            ? [{ id: ACCOUNT_ID }]
            : [],
        minerva_mail_payment_matches: [
          {
            confirmationId: "m-d1",
            confirmationGmailId: "d1",
            billId: "m-b1",
            billGmailId: "b1",
            fromLabel: "Bills/*Payable",
            toLabel: "Bills/*Paid",
          },
          {
            confirmationId: "m-d2",
            confirmationGmailId: "d2",
            billId: "m-b2",
            billGmailId: "b2",
            fromLabel: "Bills/*Payable",
            toLabel: "Bills/*Paid",
          },
        ],
      }));
      ctx.t.graphql.on("AcceptMailPaymentMatches", {
        insert_minerva_mail_payment_acceptances: { affected_rows: 1 },
      });
      const res = await ctx.as(
        ctx.t
          .http()
          .post(ACCEPT)
          .send({
            pairs: [
              { confirmationGmailId: "d1", billGmailId: "b1" },
              // d2 now pays another bill: left out.
              { confirmationGmailId: "d2", billGmailId: "b0" },
            ],
          }),
      );
      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(1);
      expect(res.body.batch).toMatchObject({ id: "batch-1" });
      expect(changes.apply).toHaveBeenCalledWith(USER, ACCOUNT_ID, {
        changes: [
          { gmailId: "b1", add: ["Bills/*Paid"], remove: ["Bills/*Payable"] },
        ],
      });
      expect(
        ctx.t.graphql.calls("AcceptMailPaymentMatches")[0].variables,
      ).toEqual({
        rows: [
          {
            confirmationId: "m-d1",
            billId: "m-b1",
            batchId: "batch-1",
            userId: USER,
          },
        ],
      });

      await ctx.signInAs(OTHER_USER);
      const other = await ctx.as(
        ctx.t
          .http()
          .post(ACCEPT)
          .send({ pairs: [{ confirmationGmailId: "d1", billGmailId: "b1" }] }),
      );
      expect(other.status).toBe(404);
    });
  });
});
