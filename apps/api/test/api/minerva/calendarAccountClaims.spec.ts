import { beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../../../src/auth/limits/RateLimiter";
import { CalendarAccountClaimService } from "../../../src/minerva/calendars/services/CalendarAccountClaimService";
import { MinervaCalendarAgentClient } from "../../../src/minerva/calendars/services/MinervaCalendarAgentClient";
import { hashState } from "../../../src/minerva/calendars/utils/signIns";
import { OTHER_USER, signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva";
const SITE = "https://olympus.example.com";
const CONFIRM_PAGE = `${SITE}/minerva/calendars/claim`;
const FROM = "Olympus <olympus@example.com>";
const ACCOUNT_ID = "ca000000-0000-4000-8000-000000000001";
const CLAIM_ID = "c1a10000-0000-4000-8000-000000000001";
const SUBJECT = "109876543210987654321";
const TOKEN = "the-token";

const agent = {
  listCalendarAccounts: vi.fn(),
  startWebSignIn: vi.fn(),
  completeWebSignIn: vi.fn(),
  deleteCalendarAccount: vi.fn(),
  listAvailableCalendars: vi.fn(),
  listCalendars: vi.fn(),
  createCalendar: vi.fn(),
  updateCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
  backfillCalendar: vi.fn(),
};

const accountRow = (overrides = {}) => ({
  id: ACCOUNT_ID,
  provider: "google",
  subject: SUBJECT,
  email: "work@example.com",
  userId: null as string | null,
  verifiedTime: null as string | null,
  verificationMethod: null as string | null,
  ...overrides,
});

const claimRow = (overrides = {}) => ({
  id: CLAIM_ID,
  userId: USER,
  expiresTime: new Date(Date.now() + 60 * 60_000).toISOString(),
  confirmedTime: null,
  cancelledTime: null,
  account: accountRow(),
  ...overrides,
});

/**
 * Claims on calendar accounts (ADR 0028, way 3) over the real HTTP stack:
 * a link mailed to the account's address, confirmed by its claimant.
 */
describe("Calendar account claims API", () => {
  const ctx = signedInApp({
    env: {
      AUTH_CLIENT_ORIGINS: SITE,
      MINERVA_CLAIM_MAIL_FROM: FROM,
      // Roles are refused only when enforced, as weatherBackfill's are.
      AUTH_MODE_USERS: "enforce",
    },
    overrides: [{ provide: MinervaCalendarAgentClient, useValue: agent }],
  });

  beforeEach(() => {
    for (const fn of Object.values(agent)) fn.mockReset();
    agent.listCalendars.mockResolvedValue([
      {
        provider: "google",
        accountLabel: "work@example.com",
        calendarId: "work@example.com",
        source: "work",
      },
    ]);
    agent.backfillCalendar.mockResolvedValue(undefined);
    agent.listCalendarAccounts.mockResolvedValue([]);
    // Each test starts with the whole day's allowance.
    (
      ctx.t.app.get(CalendarAccountClaimService) as unknown as {
        limiter: RateLimiter;
      }
    ).limiter = new RateLimiter();
  });

  describe("without an identity", () => {
    it.each([
      ["post", `${BASE}/calendar-account-claims`],
      ["get", `${BASE}/calendar-account-claim/${TOKEN}`],
      ["post", `${BASE}/calendar-account-claim/${TOKEN}/confirm`],
      ["post", `${BASE}/calendar-account/${ACCOUNT_ID}/release`],
    ] as const)("%s %s answers 401 and asks no one", async (method, path) => {
      const res = await ctx.t.http()[method](path);
      expect(res.status).toBe(401);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      expect(ctx.t.amqp.publish).not.toHaveBeenCalled();
    });
  });

  describe("CreateCalendarAccountClaim", () => {
    const claim = (body: unknown) =>
      ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/calendar-account-claims`)
          .send({ claim: body }),
      );
    const matching = (rows: unknown[], identityOwner?: string) =>
      ctx.t.graphql
        .on("ListClaimableCalendarAccounts", {
          minerva_calendar_accounts: rows,
        })
        .on("DescribeIdentityOwner", {
          olympus_user_identities: identityOwner
            ? [{ userId: identityOwner }]
            : [],
        })
        .on("CreateCalendarAccountClaim", {
          update_minerva_calendar_account_claims: { affected_rows: 1 },
          insert_minerva_calendar_account_claims_one: { id: CLAIM_ID },
        })
        .on("DescribeCalendarAccountClaimant", {
          olympus_users_by_pk: {
            displayName: "Neil",
            email: "neil@example.com",
          },
        });

    it("opens a claim on the unowned account and mails its address the link", async () => {
      matching([accountRow()]);

      const res = await claim({
        email: " Work@Example.com ",
        confirmPage: CONFIRM_PAGE,
      });

      expect(res.status).toBe(202);
      expect(res.body).toEqual({
        claimReceipt: { email: "Work@Example.com" },
      });
      // Found whatever the case, and only if no one owns it.
      const found = ctx.t.graphql.calls("ListClaimableCalendarAccounts")[0];
      expect(found?.variables).toEqual({ email: "Work@Example.com" });
      expect(found?.document).toContain("userId: { _is_null: true }");

      const created = ctx.t.graphql.calls("CreateCalendarAccountClaim")[0];
      const stored = created?.variables?.claim as Record<string, string>;
      expect(created?.variables?.accountId).toBe(ACCOUNT_ID);
      expect(stored).toMatchObject({ accountId: ACCOUNT_ID, userId: USER });
      const lifetime = Date.parse(stored.expiresTime!) - Date.now();
      expect(lifetime).toBeGreaterThan(23.9 * 3600_000);
      expect(lifetime).toBeLessThanOrEqual(24 * 3600_000);
      // The previous open claim is cancelled in the same request.
      expect(created?.document).toContain(
        "update_minerva_calendar_account_claims",
      );

      expect(ctx.t.amqp.publish).toHaveBeenCalledTimes(1);
      const [exchange, routingKey, message] = ctx.t.amqp.publish.mock.calls[0]!;
      expect(exchange).toBe("notifications.trigger");
      expect(routingKey).toBe("notifications.type.email");
      expect(message).toMatchObject({
        notificationId: CLAIM_ID,
        notificationType: "minerva_calendar_account_claim",
        from: FROM,
        to: ["work@example.com"],
        expirationTime: stored.expiresTime,
        context: {
          claimantName: "Neil",
          claimantEmail: "neil@example.com",
          provider: "google",
          accountEmail: "work@example.com",
          expiresTime: stored.expiresTime,
        },
      });
      // The link carries the token; only its hash is stored.
      const link = new URL(message.context.link);
      expect(`${link.origin}${link.pathname}`).toBe(CONFIRM_PAGE);
      const token = link.searchParams.get("token")!;
      expect(stored.tokenHash).toBe(hashState(token));
      expect(JSON.stringify(stored)).not.toContain(token);
    });

    it("answers an address no unowned account has exactly as one that has it", async () => {
      matching([accountRow()]);
      const found = await claim({
        email: "work@example.com",
        confirmPage: CONFIRM_PAGE,
      });
      matching([]);
      const notFound = await claim({
        email: "nobody@example.com",
        confirmPage: CONFIRM_PAGE,
      });

      expect(notFound.status).toBe(found.status);
      expect(Object.keys(notFound.body)).toEqual(Object.keys(found.body));
      expect(notFound.body.claimReceipt).toEqual({
        email: "nobody@example.com",
      });
      expect(ctx.t.amqp.publish).toHaveBeenCalledTimes(1);
    });

    it("mails nothing for an unowned account another user signs in with", async () => {
      matching([accountRow()], OTHER_USER);

      const res = await claim({
        email: "work@example.com",
        confirmPage: CONFIRM_PAGE,
      });

      expect(res.status).toBe(202);
      expect(ctx.t.graphql.calls("CreateCalendarAccountClaim")).toHaveLength(0);
      expect(ctx.t.amqp.publish).not.toHaveBeenCalled();
    });

    it("still answers the same when the mail cannot be queued", async () => {
      matching([accountRow()]);
      ctx.t.amqp.publish.mockRejectedValueOnce(new Error("broker down"));

      const res = await claim({
        email: "work@example.com",
        confirmPage: CONFIRM_PAGE,
      });

      expect(res.status).toBe(202);
    });

    it("refuses a sixth claim in a day, whether or not the addresses matched", async () => {
      matching([]);
      for (let i = 0; i < 5; i++) {
        const res = await claim({
          email: `nobody${i}@example.com`,
          confirmPage: CONFIRM_PAGE,
        });
        expect(res.status).toBe(202);
      }

      const sixth = await claim({
        email: "work@example.com",
        confirmPage: CONFIRM_PAGE,
      });

      expect(sixth.status).toBe(429);
      expect(ctx.t.graphql.calls("ListClaimableCalendarAccounts")).toHaveLength(
        5,
      );
      // The limit is the user's: another user may still claim.
      await ctx.signInAs(OTHER_USER);
      const theirs = await claim({
        email: "work@example.com",
        confirmPage: CONFIRM_PAGE,
      });
      expect(theirs.status).toBe(202);
    });

    it.each([
      ["no address", { confirmPage: CONFIRM_PAGE }],
      ["not an address", { email: "work", confirmPage: CONFIRM_PAGE }],
      [
        "a page of another site",
        { email: "work@example.com", confirmPage: "https://evil.example/" },
      ],
    ])("refuses %s", async (_, body) => {
      const res = await claim(body);

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DescribeCalendarAccountClaim", () => {
    const open = (claim: unknown) =>
      ctx.t.graphql.on("DescribeCalendarAccountClaim", {
        minerva_calendar_account_claims: claim ? [claim] : [],
      });
    const describeClaim = () =>
      ctx.as(ctx.t.http().get(`${BASE}/calendar-account-claim/${TOKEN}`));

    it("shows the claimant the account, finding the claim by the token's hash", async () => {
      const row = claimRow();
      open(row);

      const res = await describeClaim();

      expect(res.status).toBe(200);
      expect(res.body.claim).toEqual({
        provider: "google",
        email: "work@example.com",
        expiresTime: new Date(row.expiresTime).toISOString(),
      });
      expect(
        ctx.t.graphql.calls("DescribeCalendarAccountClaim")[0]?.variables,
      ).toEqual({ tokenHash: hashState(TOKEN) });
      // Opening the link changes nothing.
      expect(ctx.t.graphql.request).toHaveBeenCalledTimes(1);
    });

    it("refuses another user, saying why", async () => {
      open(claimRow({ userId: OTHER_USER }));

      const res = await describeClaim();

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).toContain("another Olympus user");
    });

    it.each([
      ["expired", { expiresTime: new Date(Date.now() - 1000).toISOString() }],
      ["confirmed", { confirmedTime: "2026-10-03T12:00:00Z" }],
      ["cancelled", { cancelledTime: "2026-10-03T12:00:00Z" }],
    ])("answers 410 for a claim that was %s", async (state, overrides) => {
      open(claimRow(overrides));

      const res = await describeClaim();

      expect(res.status).toBe(410);
      expect(JSON.stringify(res.body)).toContain(state);
    });

    it("answers 404 for a token no claim has", async () => {
      open(undefined);

      expect((await describeClaim()).status).toBe(404);
    });

    it("answers 409 when the account has found an owner since", async () => {
      open(claimRow({ account: accountRow({ userId: OTHER_USER }) }));

      expect((await describeClaim()).status).toBe(409);
    });
  });

  describe("ConfirmCalendarAccountClaim", () => {
    const confirm = () =>
      ctx.as(
        ctx.t.http().post(`${BASE}/calendar-account-claim/${TOKEN}/confirm`),
      );
    const confirming = ({
      claim = claimRow() as unknown,
      identityOwner = undefined as string | undefined,
      taken = 1,
      linked = 1,
    } = {}) =>
      ctx.t.graphql
        .on("DescribeCalendarAccountClaim", {
          minerva_calendar_account_claims: [claim],
        })
        .on("DescribeIdentityOwner", {
          olympus_user_identities: identityOwner
            ? [{ userId: identityOwner }]
            : [],
        })
        .on("TakeCalendarAccountClaim", {
          update_minerva_calendar_account_claims: { affected_rows: taken },
        })
        .on("LinkClaimedCalendarAccount", {
          update_minerva_calendar_accounts: { affected_rows: linked },
        })
        .on("DescribeCalendarAccount", {
          minerva_calendar_accounts: [
            accountRow({
              userId: USER,
              verifiedTime: "2026-10-04T12:00:00Z",
              verificationMethod: "claim_email",
            }),
          ],
        });

    it("links the account to the claimant by email and backfills it", async () => {
      confirming();

      const res = await confirm();

      expect(res.status).toBe(200);
      expect(res.body.calendarAccount).toMatchObject({
        id: ACCOUNT_ID,
        verification: "claim_email",
      });
      expect(
        ctx.t.graphql.calls("TakeCalendarAccountClaim")[0]?.variables,
      ).toMatchObject({ id: CLAIM_ID });
      const link = ctx.t.graphql.calls("LinkClaimedCalendarAccount")[0];
      expect(link?.variables).toMatchObject({ id: ACCOUNT_ID, userId: USER });
      expect(link?.document).toContain('verificationMethod: "claim_email"');
      expect(link?.document).toContain("userId: { _is_null: true }");
      expect(agent.backfillCalendar).toHaveBeenCalledWith("work@example.com");
    });

    it("answers 410 when the claim was used in the meantime, linking nothing", async () => {
      confirming({ taken: 0 });

      const res = await confirm();

      expect(res.status).toBe(410);
      expect(ctx.t.graphql.calls("LinkClaimedCalendarAccount")).toHaveLength(0);
      expect(agent.backfillCalendar).not.toHaveBeenCalled();
    });

    it("answers 409 when the account found an owner in the meantime", async () => {
      confirming({ linked: 0 });

      const res = await confirm();

      expect(res.status).toBe(409);
      expect(agent.backfillCalendar).not.toHaveBeenCalled();
    });

    it("refuses an account another user signs in with", async () => {
      confirming({ identityOwner: OTHER_USER });

      const res = await confirm();

      expect(res.status).toBe(409);
      expect(ctx.t.graphql.calls("TakeCalendarAccountClaim")).toHaveLength(0);
    });

    it("refuses another user, changing nothing", async () => {
      confirming({ claim: claimRow({ userId: OTHER_USER }) });

      const res = await confirm();

      expect(res.status).toBe(403);
      expect(ctx.t.graphql.calls("TakeCalendarAccountClaim")).toHaveLength(0);
    });

    it("answers 410 for a claim already confirmed", async () => {
      confirming({
        claim: claimRow({ confirmedTime: "2026-10-03T12:00:00Z" }),
      });

      expect((await confirm()).status).toBe(410);
      expect(ctx.t.graphql.calls("TakeCalendarAccountClaim")).toHaveLength(0);
    });
  });

  describe("ReleaseCalendarAccount", () => {
    const release = () =>
      ctx.as(
        ctx.t.http().post(`${BASE}/calendar-account/${ACCOUNT_ID}/release`),
      );

    it("makes the account unowned, deleting its meetings and cancelling its claims", async () => {
      await ctx.signInAs(USER, ["user", "admin"]);
      ctx.t.graphql.on("ReleaseCalendarAccount", {
        update_minerva_calendar_accounts: { affected_rows: 1 },
        delete_minerva_meetings: { affected_rows: 40 },
        update_minerva_calendar_account_claims: { affected_rows: 0 },
      });

      const res = await release();

      expect(res.status).toBe(204);
      const call = ctx.t.graphql.calls("ReleaseCalendarAccount")[0];
      expect(call?.variables).toMatchObject({ id: ACCOUNT_ID });
      expect(call?.document).toContain("userId: null");
      expect(call?.document).toContain("delete_minerva_meetings");
      // Notes, meeting links and associations stay.
      expect(call?.document).not.toMatch(
        /delete_minerva_(notes|meeting_notes|note_associations)/,
      );
      // The agent keeps the credential.
      expect(agent.deleteCalendarAccount).not.toHaveBeenCalled();
    });

    it("answers 404 for an account that does not exist", async () => {
      await ctx.signInAs(USER, ["user", "admin"]);
      ctx.t.graphql.on("ReleaseCalendarAccount", {
        update_minerva_calendar_accounts: { affected_rows: 0 },
        delete_minerva_meetings: { affected_rows: 0 },
        update_minerva_calendar_account_claims: { affected_rows: 0 },
      });

      expect((await release()).status).toBe(404);
    });

    it("is an admin's", async () => {
      const res = await release();

      expect(res.status).toBe(403);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });
});
