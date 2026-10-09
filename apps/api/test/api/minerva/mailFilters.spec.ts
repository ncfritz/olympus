import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinervaMailAgentClient } from "../../../src/minerva/mail/services/MinervaMailAgentClient";
import { OTHER_USER, signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva/mail";
const ACCOUNT_ID = "7b2b0000-0000-4000-8000-000000000001";
const FILTER_ID = "7b2b0000-0000-4000-8000-0000000000f1";
const LABEL_ID = "7b2b0000-0000-4000-8000-0000000000c1";

const agent = {
  createFilter: vi.fn(),
  deleteFilter: vi.fn(),
};

/* Synthetic mail (never real). */
const filterRow = (overrides: Record<string, unknown> = {}) => ({
  id: FILTER_ID,
  accountId: ACCOUNT_ID,
  fromAddress: "orders@shop.example",
  skipInbox: true,
  createdTime: "2026-10-07T17:00:00+00:00",
  label: { name: "Shopping" },
  ...overrides,
});

/** Gmail filters (docs/plans/email-management phase 7 step 4). */
describe("Mail filters", () => {
  const ctx = signedInApp({
    env: { MINERVA_MAIL_WRITES_ENABLED: "true" },
    overrides: [{ provide: MinervaMailAgentClient, useValue: agent }],
  });

  const target = (filtered = false) =>
    ctx.t.graphql.on("DescribeMailFilterTarget", (vars) => {
      const v = vars as { userId: string; label: string };
      return {
        minerva_mail_accounts:
          v.userId === USER
            ? [
                {
                  email: "neil@example.com",
                  labels: v.label === "Shopping" ? [{ id: LABEL_ID }] : [],
                },
              ]
            : [],
        minerva_mail_filters: filtered ? [{ id: FILTER_ID }] : [],
      };
    });

  beforeEach(() => {
    for (const fn of Object.values(agent)) fn.mockReset();
    agent.createFilter.mockResolvedValue("ANe1Bmj");
    agent.deleteFilter.mockResolvedValue(undefined);
  });

  describe("ListMailFilterProposals", () => {
    it("lists the caller's proposals", async () => {
      ctx.t.graphql.on("ListMailFilterProposals", {
        minerva_mail_filter_proposals: [
          {
            accountId: ACCOUNT_ID,
            fromAddress: "orders@shop.example",
            label: "Shopping",
            decisions: 25,
            kept: 25,
            lastDecidedTime: "2026-10-07T16:00:00+00:00",
          },
        ],
      });
      const res = await ctx.as(ctx.t.http().get(`${BASE}/filter-proposals`));
      expect(res.status).toBe(200);
      expect(res.body.proposals).toEqual([
        {
          accountId: ACCOUNT_ID,
          fromAddress: "orders@shop.example",
          label: "Shopping",
          decisions: 25,
          kept: 25,
          lastDecidedTime: "2026-10-07T16:00:00.000Z",
        },
      ]);
      expect(
        ctx.t.graphql.calls("ListMailFilterProposals")[0].variables,
      ).toEqual({
        where: { account: { userId: { _eq: USER } } },
        limit: 200,
      });
    });
  });

  describe("CreateMailFilter", () => {
    const create = (body: unknown) =>
      ctx.as(
        ctx.t.http().post(`${BASE}/account/${ACCOUNT_ID}/filters`).send(body),
      );

    it("makes the filter in Gmail and keeps it", async () => {
      target();
      ctx.t.graphql.on("CreateMailFilter", {
        insert_minerva_mail_filters_one: filterRow(),
      });
      const res = await create({
        fromAddress: "Orders@Shop.example",
        label: "Shopping",
        skipInbox: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.filter).toEqual({
        id: FILTER_ID,
        accountId: ACCOUNT_ID,
        fromAddress: "orders@shop.example",
        label: "Shopping",
        skipInbox: true,
        createdTime: "2026-10-07T17:00:00.000Z",
      });
      expect(agent.createFilter).toHaveBeenCalledWith({
        email: "neil@example.com",
        from: "orders@shop.example",
        label: "Shopping",
        skipInbox: true,
      });
      expect(ctx.t.graphql.calls("CreateMailFilter")[0].variables).toEqual({
        filter: {
          accountId: ACCOUNT_ID,
          fromAddress: "orders@shop.example",
          labelId: LABEL_ID,
          skipInbox: true,
          gmailFilterId: "ANe1Bmj",
          userId: USER,
        },
      });
    });

    it("takes the filter back out of Gmail when it cannot be kept", async () => {
      target();
      ctx.t.graphql.on("CreateMailFilter", () => {
        throw new Error("Hasura away");
      });
      const res = await create({
        fromAddress: "orders@shop.example",
        label: "Shopping",
        skipInbox: false,
      });
      expect(res.status).toBe(500);
      expect(agent.deleteFilter).toHaveBeenCalledWith(
        "neil@example.com",
        "ANe1Bmj",
      );
    });

    it("answers 409 for a sender with a filter for the label already", async () => {
      target(true);
      const res = await create({
        fromAddress: "orders@shop.example",
        label: "Shopping",
        skipInbox: true,
      });
      expect(res.status).toBe(409);
      expect(agent.createFilter).not.toHaveBeenCalled();
    });

    it("answers 404 for another user's account, or a label the account lacks", async () => {
      target();
      const res = await create({
        fromAddress: "orders@shop.example",
        label: "Gone",
        skipInbox: true,
      });
      expect(res.status).toBe(404);
      await ctx.signInAs(OTHER_USER);
      const other = await create({
        fromAddress: "orders@shop.example",
        label: "Shopping",
        skipInbox: true,
      });
      expect(other.status).toBe(404);
      expect(agent.createFilter).not.toHaveBeenCalled();
    });

    it.each([
      ["no sender", { label: "Shopping", skipInbox: true }],
      [
        "a sender that is not an address",
        { fromAddress: "shop", label: "Shopping", skipInbox: true },
      ],
      [
        "no skipInbox",
        { fromAddress: "orders@shop.example", label: "Shopping" },
      ],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await create(body);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("DescribeMailFilterTarget")).toHaveLength(0);
    });
  });

  describe("DismissMailFilterProposal", () => {
    it("records the proposal as declined", async () => {
      target();
      ctx.t.graphql.on("DismissMailFilterProposal", {
        insert_minerva_mail_filter_dismissals_one: { accountId: ACCOUNT_ID },
      });
      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/account/${ACCOUNT_ID}/filter-proposals/dismiss`)
          .send({ fromAddress: "orders@shop.example", label: "Shopping" }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ dismissed: true });
      expect(
        ctx.t.graphql.calls("DismissMailFilterProposal")[0].variables,
      ).toEqual({
        row: {
          accountId: ACCOUNT_ID,
          fromAddress: "orders@shop.example",
          labelId: LABEL_ID,
        },
      });
    });
  });

  describe("ListMailFilters and DeleteMailFilter", () => {
    it("lists the caller's filters", async () => {
      ctx.t.graphql.on("ListMailFilters", {
        minerva_mail_filters: [filterRow()],
      });
      const res = await ctx.as(ctx.t.http().get(`${BASE}/filters`));
      expect(res.status).toBe(200);
      expect(res.body.filters[0]).toMatchObject({
        fromAddress: "orders@shop.example",
        label: "Shopping",
      });
    });

    it("deletes in Gmail, then here", async () => {
      ctx.t.graphql.on("DescribeMailFilter", (vars) => ({
        minerva_mail_filters:
          (vars as { userId: string }).userId === USER
            ? [
                {
                  id: FILTER_ID,
                  gmailFilterId: "ANe1Bmj",
                  account: { email: "neil@example.com" },
                },
              ]
            : [],
      }));
      ctx.t.graphql.on("DeleteMailFilter", {
        delete_minerva_mail_filters_by_pk: { id: FILTER_ID },
      });
      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/filter/${FILTER_ID}`),
      );
      expect(res.status).toBe(204);
      expect(agent.deleteFilter).toHaveBeenCalledWith(
        "neil@example.com",
        "ANe1Bmj",
      );
      expect(ctx.t.graphql.calls("DeleteMailFilter")).toHaveLength(1);

      await ctx.signInAs(OTHER_USER);
      const other = await ctx.as(
        ctx.t.http().delete(`${BASE}/filter/${FILTER_ID}`),
      );
      expect(other.status).toBe(404);
    });
  });
});
