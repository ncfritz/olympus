import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinervaCalendarAgentClient } from "../../../src/minerva/calendars/services/MinervaCalendarAgentClient";
import { hashState } from "../../../src/minerva/calendars/utils/signIns";
import { OTHER_USER, signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva";
const SITE = "https://olympus.example.com";
const RETURN_TO = `${SITE}/minerva/calendars`;
const CALLBACK = `https://api.example.com/v1/minerva/calendar-accounts/callback`;
const ACCOUNT_ID = "ca000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT_ID = "ca000000-0000-4000-8000-000000000002";
const SUBJECT = "109876543210987654321";

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
  email: "neil@example.com",
  userId: USER,
  verifiedTime: "2026-10-03T12:00:00Z",
  verificationMethod: "consent",
  ...overrides,
});

const agentAccount = (overrides = {}) => ({
  accountLabel: "neil@example.com",
  provider: "google",
  subject: SUBJECT,
  sources: ["neil"],
  status: "ok",
  ...overrides,
});

const agentCalendar = (overrides = {}) => ({
  provider: "google",
  accountLabel: "neil@example.com",
  calendarId: "neil@example.com",
  source: "neil",
  synced: true,
  enablePush: false,
  enabled: true,
  syncing: false,
  includedInBusy: true,
  ...overrides,
});

const connectionRow = (overrides = {}) => ({
  id: "cc000000-0000-4000-8000-000000000001",
  userId: USER,
  provider: "google",
  codeVerifier: "verifier",
  accountId: null,
  returnTo: RETURN_TO,
  expiresTime: new Date(Date.now() + 5 * 60_000).toISOString(),
  completedTime: new Date().toISOString(),
  account: null,
  ...overrides,
});

const outcome = (
  location: string | undefined,
): { page: string } & Record<string, string> => {
  const url = new URL(location ?? "about:blank");
  return {
    page: `${url.origin}${url.pathname}`,
    ...Object.fromEntries(url.searchParams),
  };
};

/**
 * The calendar account operations over the real HTTP stack (ADR 0028):
 * the user's accounts, and the provider sign-ins that link one to them.
 * The sync agent is replaced by a mock; its own specs cover its side.
 */
describe("Calendar accounts API", () => {
  const ctx = signedInApp({
    env: {
      AUTH_PUBLIC_BASE_URL: "https://api.example.com",
      AUTH_CLIENT_ORIGINS: `${SITE},http://localhost:3000`,
    },
    overrides: [{ provide: MinervaCalendarAgentClient, useValue: agent }],
  });

  beforeEach(() => {
    for (const fn of Object.values(agent)) fn.mockReset();
    // The account's calendars at the agent, beside another account's.
    agent.listCalendars.mockResolvedValue([
      agentCalendar({ calendarId: "neil@example.com" }),
      agentCalendar({ calendarId: "team@group.calendar.google.com" }),
      agentCalendar({
        accountLabel: "theirs@example.com",
        calendarId: "theirs@example.com",
      }),
    ]);
    agent.backfillCalendar.mockResolvedValue(undefined);
  });

  describe("without an identity", () => {
    it.each([
      ["get", `${BASE}/calendar-accounts`],
      ["post", `${BASE}/calendar-accounts/connect`],
      ["get", `${BASE}/calendar-account/${ACCOUNT_ID}`],
      ["post", `${BASE}/calendar-account/${ACCOUNT_ID}/reauthorize`],
      ["delete", `${BASE}/calendar-account/${ACCOUNT_ID}`],
    ] as const)("%s %s answers 401 and asks no one", async (method, path) => {
      const res = await ctx.t.http()[method](path);
      expect(res.status).toBe(401);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      for (const fn of Object.values(agent)) {
        expect(fn).not.toHaveBeenCalled();
      }
    });
  });

  describe("ListCalendarAccounts", () => {
    const listing = (rows: unknown[]) => {
      ctx.t.graphql
        .on("RecordCalendarAccounts", {
          insert_minerva_calendar_accounts: { affected_rows: 1 },
        })
        .on("ListUserIdentities", { olympus_user_identities: [] })
        .on("ListCalendarAccounts", { minerva_calendar_accounts: rows });
    };

    it("lists the user's accounts with their credentials' state", async () => {
      agent.listCalendarAccounts.mockResolvedValue([
        agentAccount({ status: "expired", error: "invalid_grant" }),
      ]);
      listing([accountRow()]);

      const res = await ctx.as(ctx.t.http().get(`${BASE}/calendar-accounts`));

      expect(res.status).toBe(200);
      expect(res.body.calendarAccounts).toEqual([
        {
          id: ACCOUNT_ID,
          provider: "google",
          email: "neil@example.com",
          status: "expired",
          error: "invalid_grant",
          verification: "consent",
          verifiedTime: "2026-10-03T12:00:00.000Z",
        },
      ]);
      expect(ctx.t.graphql.calls("ListCalendarAccounts")[0]?.variables).toEqual(
        { userId: USER },
      );
    });

    it("records the accounts the agent holds, owned or not, but not those without a subject", async () => {
      agent.listCalendarAccounts.mockResolvedValue([
        agentAccount(),
        agentAccount({ accountLabel: "old@example.com", subject: undefined }),
      ]);
      listing([]);

      await ctx.as(ctx.t.http().get(`${BASE}/calendar-accounts`));

      const recorded = ctx.t.graphql.calls("RecordCalendarAccounts")[0];
      expect(recorded?.variables).toEqual({
        objects: [
          { provider: "google", subject: SUBJECT, email: "neil@example.com" },
        ],
      });
      // A recorded account gets no owner from being recorded.
      expect(recorded?.document).toContain("update_columns: [email]");
    });

    it("links unowned accounts that are the user's sign-in identities", async () => {
      agent.listCalendarAccounts.mockResolvedValue([agentAccount()]);
      listing([accountRow({ verificationMethod: "sign_in" })]);
      ctx.t.graphql
        .on("ListUserIdentities", {
          olympus_user_identities: [
            { provider: "google", subject: SUBJECT },
            { provider: "github", subject: "12345" },
          ],
        })
        .on("LinkSignInIdentities", {
          update_minerva_calendar_accounts: {
            returning: [{ provider: "google", email: "neil@example.com" }],
          },
        });

      const res = await ctx.as(ctx.t.http().get(`${BASE}/calendar-accounts`));

      expect(res.status).toBe(200);
      const link = ctx.t.graphql.calls("LinkSignInIdentities")[0]?.variables;
      expect(link).toMatchObject({
        userId: USER,
        where: {
          userId: { _is_null: true },
          _or: [{ provider: { _eq: "google" }, subject: { _eq: SUBJECT } }],
        },
      });
      expect(
        ctx.t.graphql.calls("LinkSignInIdentities")[0]?.document,
      ).toContain('verificationMethod: "sign_in"');
      // Its events from before the link are published again.
      expect(agent.backfillCalendar.mock.calls).toEqual([
        ["neil@example.com"],
        ["team@group.calendar.google.com"],
      ]);
    });

    it("backfills nothing when no account was newly linked", async () => {
      agent.listCalendarAccounts.mockResolvedValue([agentAccount()]);
      listing([accountRow({ verificationMethod: "sign_in" })]);
      ctx.t.graphql
        .on("ListUserIdentities", {
          olympus_user_identities: [{ provider: "google", subject: SUBJECT }],
        })
        .on("LinkSignInIdentities", {
          update_minerva_calendar_accounts: { returning: [] },
        });

      await ctx.as(ctx.t.http().get(`${BASE}/calendar-accounts`));

      expect(agent.backfillCalendar).not.toHaveBeenCalled();
    });

    it("still lists the accounts, their state unknown, when the agent cannot be asked", async () => {
      agent.listCalendarAccounts.mockRejectedValue(
        new BadGatewayException("down"),
      );
      ctx.t.graphql.on("ListCalendarAccounts", {
        minerva_calendar_accounts: [accountRow()],
      });

      const res = await ctx.as(ctx.t.http().get(`${BASE}/calendar-accounts`));

      expect(res.status).toBe(200);
      expect(res.body.calendarAccounts[0].status).toBe("unknown");
      expect(ctx.t.graphql.calls("RecordCalendarAccounts")).toHaveLength(0);
    });

    it("shows an account the agent no longer holds as not connected", async () => {
      agent.listCalendarAccounts.mockResolvedValue([]);
      ctx.t.graphql.on("ListCalendarAccounts", {
        minerva_calendar_accounts: [accountRow()],
      });
      ctx.t.graphql.on("ListUserIdentities", { olympus_user_identities: [] });

      const res = await ctx.as(ctx.t.http().get(`${BASE}/calendar-accounts`));

      expect(res.body.calendarAccounts[0].status).toBe("not_connected");
    });
  });

  describe("DescribeCalendarAccount", () => {
    it("describes one of the user's accounts", async () => {
      agent.listCalendarAccounts.mockResolvedValue([agentAccount()]);
      ctx.t.graphql.on("DescribeCalendarAccount", {
        minerva_calendar_accounts: [accountRow()],
      });

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/calendar-account/${ACCOUNT_ID}`),
      );

      expect(res.status).toBe(200);
      expect(res.body.calendarAccount).toMatchObject({
        id: ACCOUNT_ID,
        status: "ok",
      });
      expect(
        ctx.t.graphql.calls("DescribeCalendarAccount")[0]?.variables,
      ).toEqual({ id: ACCOUNT_ID, userId: USER });
    });

    it("does not find another user's account", async () => {
      ctx.t.graphql.on("DescribeCalendarAccount", {
        minerva_calendar_accounts: [],
      });

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/calendar-account/${OTHER_ACCOUNT_ID}`),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("ConnectCalendarAccount", () => {
    const connect = (connection: unknown) =>
      ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/calendar-accounts/connect`)
          .send({ connection }),
      );

    it("records the sign-in and returns the provider's page", async () => {
      ctx.t.graphql.on("CreateCalendarAccountConnection", {
        insert_minerva_calendar_account_connections_one: { id: "c" },
      });
      agent.startWebSignIn.mockResolvedValue(
        "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      );

      const res = await connect({ provider: "google", returnTo: RETURN_TO });

      expect(res.status).toBe(200);
      expect(res.body.signIn).toEqual({
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      });
      const stored = ctx.t.graphql.calls("CreateCalendarAccountConnection")[0]
        ?.variables?.object as Record<string, unknown>;
      const asked = agent.startWebSignIn.mock.calls[0]?.[0];
      expect(stored).toMatchObject({
        userId: USER,
        provider: "google",
        accountId: null,
        returnTo: RETURN_TO,
      });
      expect(asked).toMatchObject({
        provider: "google",
        redirectUri: `${CALLBACK}/google`,
      });
      // The state goes to the provider; only its hash is kept.
      expect(stored.stateHash).toBe(hashState(asked.state));
      expect(JSON.stringify(stored)).not.toContain(asked.state);
      expect(asked.accountLabel).toBeUndefined();
      const lifetime = Date.parse(stored.expiresTime as string) - Date.now();
      expect(lifetime).toBeGreaterThan(9 * 60_000);
      expect(lifetime).toBeLessThanOrEqual(10 * 60_000);
    });

    it.each([
      ["an unknown provider", { provider: "yahoo", returnTo: RETURN_TO }],
      [
        "a page of another site",
        { provider: "google", returnTo: "https://evil.example.com/" },
      ],
      ["no page", { provider: "google" }],
    ])("refuses %s", async (_, connection) => {
      const res = await connect(connection);

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      expect(agent.startWebSignIn).not.toHaveBeenCalled();
    });
  });

  describe("ReauthorizeCalendarAccount", () => {
    it("signs in again to the user's account, naming it to the agent", async () => {
      ctx.t.graphql
        .on("DescribeCalendarAccount", {
          minerva_calendar_accounts: [accountRow({ provider: "microsoft" })],
        })
        .on("CreateCalendarAccountConnection", {
          insert_minerva_calendar_account_connections_one: { id: "c" },
        });
      agent.startWebSignIn.mockResolvedValue(
        "https://login.microsoftonline.com/x",
      );

      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/calendar-account/${ACCOUNT_ID}/reauthorize`)
          .send({ reauthorization: { returnTo: RETURN_TO } }),
      );

      expect(res.status).toBe(200);
      expect(
        ctx.t.graphql.calls("CreateCalendarAccountConnection")[0]?.variables
          ?.object,
      ).toMatchObject({ accountId: ACCOUNT_ID, provider: "microsoft" });
      expect(agent.startWebSignIn.mock.calls[0]?.[0]).toMatchObject({
        provider: "microsoft",
        accountLabel: "neil@example.com",
        redirectUri: `${CALLBACK}/microsoft`,
      });
    });

    it("does not find another user's account", async () => {
      ctx.t.graphql.on("DescribeCalendarAccount", {
        minerva_calendar_accounts: [],
      });

      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/calendar-account/${OTHER_ACCOUNT_ID}/reauthorize`)
          .send({ reauthorization: { returnTo: RETURN_TO } }),
      );

      expect(res.status).toBe(404);
      expect(agent.startWebSignIn).not.toHaveBeenCalled();
    });
  });

  describe("CompleteCalendarAccountConnect", () => {
    const STATE = "the-state";
    const callback = (provider: string, query: Record<string, string>) =>
      ctx.t
        .http()
        .get(`${BASE}/calendar-accounts/callback/${provider}`)
        .query(query);
    const waiting = (connection: unknown) =>
      ctx.t.graphql.on("TakeCalendarAccountConnection", {
        update_minerva_calendar_account_connections: {
          returning: connection ? [connection] : [],
        },
      });
    const owners = ({
      owner,
      identityOwner,
    }: { owner?: string | null; identityOwner?: string } = {}) =>
      ctx.t.graphql
        .on("DescribeCalendarAccountBySubject", {
          minerva_calendar_accounts:
            owner === undefined ? [] : [accountRow({ userId: owner })],
        })
        .on("DescribeIdentityOwner", {
          olympus_user_identities: identityOwner
            ? [{ userId: identityOwner }]
            : [],
        })
        .on("LinkCalendarAccount", {
          insert_minerva_calendar_accounts_one: { id: ACCOUNT_ID },
        });

    it("links a new account to the user who started the sign-in", async () => {
      waiting(connectionRow());
      owners();
      agent.completeWebSignIn.mockResolvedValue({
        provider: "google",
        accountLabel: "neil@example.com",
        subject: SUBJECT,
        created: true,
      });

      const res = await callback("google", { state: STATE, code: "4/abc" });

      expect(res.status).toBe(302);
      expect(outcome(res.headers.location)).toEqual({
        page: RETURN_TO,
        calendarAccount: "connected",
        accountId: ACCOUNT_ID,
      });
      expect(
        ctx.t.graphql.calls("TakeCalendarAccountConnection")[0]?.variables,
      ).toMatchObject({ stateHash: hashState(STATE) });
      const redeemed = agent.completeWebSignIn.mock.calls[0]?.[0];
      expect(redeemed).toMatchObject({
        provider: "google",
        redirectUri: `${CALLBACK}/google`,
        state: STATE,
        codeVerifier: "verifier",
      });
      expect(redeemed.callbackUrl).toContain("code=4%2Fabc");
      expect(
        ctx.t.graphql.calls("LinkCalendarAccount")[0]?.variables,
      ).toMatchObject({
        object: {
          provider: "google",
          subject: SUBJECT,
          email: "neil@example.com",
          userId: USER,
          verificationMethod: "consent",
        },
        columns: ["email", "userId", "verifiedTime", "verificationMethod"],
      });
      expect(agent.deleteCalendarAccount).not.toHaveBeenCalled();
      // Only this account's calendars are published again.
      expect(agent.backfillCalendar.mock.calls).toEqual([
        ["neil@example.com"],
        ["team@group.calendar.google.com"],
      ]);
    });

    it("still connects the account when its backfill fails", async () => {
      waiting(connectionRow());
      owners();
      agent.completeWebSignIn.mockResolvedValue({
        provider: "google",
        accountLabel: "neil@example.com",
        subject: SUBJECT,
        created: true,
      });
      agent.backfillCalendar.mockRejectedValue(new BadGatewayException("down"));

      const res = await callback("google", { state: STATE, code: "c" });

      expect(outcome(res.headers.location).calendarAccount).toBe("connected");
    });

    it("keeps the proof of an account already the user's", async () => {
      waiting(connectionRow({ accountId: ACCOUNT_ID, account: accountRow() }));
      owners({ owner: USER });
      agent.completeWebSignIn.mockResolvedValue({
        provider: "google",
        accountLabel: "neil@example.com",
        subject: SUBJECT,
        created: false,
      });

      const res = await callback("google", { state: STATE, code: "c" });

      expect(outcome(res.headers.location).calendarAccount).toBe("connected");
      expect(agent.completeWebSignIn.mock.calls[0]?.[0].accountLabel).toBe(
        "neil@example.com",
      );
      expect(
        ctx.t.graphql.calls("LinkCalendarAccount")[0]?.variables?.columns,
      ).toEqual(["email"]);
      // Its events are in Minerva already.
      expect(agent.backfillCalendar).not.toHaveBeenCalled();
    });

    it.each([
      ["another user's account", { owner: OTHER_USER }],
      [
        "an unowned account another user signs in with",
        { identityOwner: OTHER_USER },
      ],
    ])(
      "refuses %s and deletes the credential the agent just stored",
      async (_, facts) => {
        waiting(connectionRow());
        owners(facts);
        agent.completeWebSignIn.mockResolvedValue({
          provider: "google",
          accountLabel: "theirs@example.com",
          subject: SUBJECT,
          created: true,
        });

        const res = await callback("google", { state: STATE, code: "c" });

        expect(outcome(res.headers.location)).toEqual({
          page: RETURN_TO,
          calendarAccount: "refused",
          reason: "owned",
        });
        expect(ctx.t.graphql.calls("LinkCalendarAccount")).toHaveLength(0);
        expect(agent.backfillCalendar).not.toHaveBeenCalled();
        expect(agent.deleteCalendarAccount).toHaveBeenCalledWith(
          "google",
          "theirs@example.com",
        );
      },
    );

    it("refuses another user's account without deleting a credential the agent already held", async () => {
      waiting(connectionRow());
      owners({ owner: OTHER_USER });
      agent.completeWebSignIn.mockResolvedValue({
        provider: "google",
        accountLabel: "theirs@example.com",
        subject: SUBJECT,
        created: false,
      });

      const res = await callback("google", { state: STATE, code: "c" });

      expect(outcome(res.headers.location).calendarAccount).toBe("refused");
      expect(agent.deleteCalendarAccount).not.toHaveBeenCalled();
    });

    it("refuses a reauthorization by a different account", async () => {
      waiting(connectionRow({ accountId: ACCOUNT_ID, account: accountRow() }));
      agent.completeWebSignIn.mockRejectedValue(
        new ConflictException("a different account signed in"),
      );

      const res = await callback("google", { state: STATE, code: "c" });

      expect(outcome(res.headers.location)).toEqual({
        page: RETURN_TO,
        calendarAccount: "refused",
        reason: "another-account",
      });
    });

    it("sends the browser back when the user cancelled at the provider", async () => {
      waiting(connectionRow());

      const res = await callback("google", {
        state: STATE,
        error: "access_denied",
      });

      expect(outcome(res.headers.location).calendarAccount).toBe("cancelled");
      expect(agent.completeWebSignIn).not.toHaveBeenCalled();
    });

    it("refuses a sign-in that took too long", async () => {
      waiting(
        connectionRow({
          expiresTime: new Date(Date.now() - 1000).toISOString(),
        }),
      );

      const res = await callback("google", { state: STATE, code: "c" });

      expect(outcome(res.headers.location).calendarAccount).toBe("expired");
      expect(agent.completeWebSignIn).not.toHaveBeenCalled();
    });

    it("reports a failure the agent gives", async () => {
      waiting(connectionRow());
      agent.completeWebSignIn.mockRejectedValue(
        new BadGatewayException("down"),
      );

      const res = await callback("google", { state: STATE, code: "c" });

      expect(outcome(res.headers.location).calendarAccount).toBe("failed");
    });

    it("fails, and forgets the credential, when the provider names no subject", async () => {
      waiting(connectionRow());
      agent.completeWebSignIn.mockResolvedValue({
        provider: "google",
        accountLabel: "neil@example.com",
        created: true,
      });

      const res = await callback("google", { state: STATE, code: "c" });

      expect(outcome(res.headers.location).calendarAccount).toBe("failed");
      expect(agent.deleteCalendarAccount).toHaveBeenCalledWith(
        "google",
        "neil@example.com",
      );
    });

    it("answers 400 to a state no sign-in is waiting for, such as a replay", async () => {
      waiting(undefined);

      const res = await callback("google", { state: STATE, code: "c" });

      expect(res.status).toBe(400);
      expect(res.headers.location).toBeUndefined();
      expect(agent.completeWebSignIn).not.toHaveBeenCalled();
    });

    it("answers 400 to a callback for another provider than the sign-in's", async () => {
      waiting(connectionRow({ provider: "microsoft" }));

      const res = await callback("google", { state: STATE, code: "c" });

      expect(res.status).toBe(400);
      expect(agent.completeWebSignIn).not.toHaveBeenCalled();
    });

    it("answers 400 without a state", async () => {
      const res = await callback("google", { code: "c" });

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("RemoveCalendarAccount", () => {
    it("deletes the credential at the agent, then the account and its meetings", async () => {
      ctx.t.graphql
        .on("DescribeCalendarAccount", {
          minerva_calendar_accounts: [accountRow()],
        })
        .on("RemoveCalendarAccount", {
          delete_minerva_meetings: { affected_rows: 12 },
          delete_minerva_calendar_accounts: { affected_rows: 1 },
        });
      agent.deleteCalendarAccount.mockResolvedValue(undefined);

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/calendar-account/${ACCOUNT_ID}`),
      );

      expect(res.status).toBe(204);
      expect(agent.deleteCalendarAccount).toHaveBeenCalledWith(
        "google",
        "neil@example.com",
      );
      const removal = ctx.t.graphql.calls("RemoveCalendarAccount")[0];
      expect(removal?.variables).toEqual({ id: ACCOUNT_ID, userId: USER });
      // Notes, their meeting links and associations stay (ADR 0028).
      expect(removal?.document).not.toMatch(
        /delete_minerva_(notes|meeting_notes|note_associations)/,
      );
    });

    it("removes an account the agent no longer holds", async () => {
      ctx.t.graphql
        .on("DescribeCalendarAccount", {
          minerva_calendar_accounts: [accountRow()],
        })
        .on("RemoveCalendarAccount", {
          delete_minerva_meetings: { affected_rows: 0 },
          delete_minerva_calendar_accounts: { affected_rows: 1 },
        });
      agent.deleteCalendarAccount.mockRejectedValue(
        new NotFoundException("no such account"),
      );

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/calendar-account/${ACCOUNT_ID}`),
      );

      expect(res.status).toBe(204);
    });

    it("keeps the account when the agent fails", async () => {
      ctx.t.graphql.on("DescribeCalendarAccount", {
        minerva_calendar_accounts: [accountRow()],
      });
      agent.deleteCalendarAccount.mockRejectedValue(
        new BadGatewayException("down"),
      );

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/calendar-account/${ACCOUNT_ID}`),
      );

      expect(res.status).toBe(502);
      expect(ctx.t.graphql.calls("RemoveCalendarAccount")).toHaveLength(0);
    });

    it("does not find another user's account", async () => {
      ctx.t.graphql.on("DescribeCalendarAccount", {
        minerva_calendar_accounts: [],
      });

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/calendar-account/${OTHER_ACCOUNT_ID}`),
      );

      expect(res.status).toBe(404);
      expect(agent.deleteCalendarAccount).not.toHaveBeenCalled();
    });
  });
});
