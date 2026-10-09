import { BadGatewayException, ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashState } from "../../../src/minerva/calendars/utils/signIns";
import { MinervaMailAgentClient } from "../../../src/minerva/mail/services/MinervaMailAgentClient";
import { signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva";
const SITE = "https://olympus.example.com";
const RETURN_TO = `${SITE}/minerva/mail`;
const CALLBACK = "https://api.example.com/v1/minerva/mail/accounts/callback";
const ACCOUNT_ID = "7b2b0000-0000-4000-8000-000000000001";
const SUBJECT = "109876543210987654321";
const SCOPE = "openid email https://www.googleapis.com/auth/gmail.readonly";

const agent = {
  startSignIn: vi.fn(),
  completeSignIn: vi.fn(),
  deleteAccount: vi.fn(),
};

const accountRow = (overrides = {}) => ({
  id: ACCOUNT_ID,
  userId: USER,
  email: "neil@example.com",
  verificationMethod: "import",
  verifiedTime: "2026-10-05T12:00:00Z",
  linkedTime: null,
  linkScope: null,
  subject: null,
  ...overrides,
});

const connectionRow = (overrides = {}) => ({
  id: "cc000000-0000-4000-8000-000000000001",
  userId: USER,
  accountId: ACCOUNT_ID,
  codeVerifier: "verifier",
  returnTo: RETURN_TO,
  expiresTime: new Date(Date.now() + 5 * 60_000).toISOString(),
  account: accountRow(),
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
 * Linking a mail account to Gmail (docs/plans/email-management phase 1b):
 * the API's half of the consent flow. The mail agent is a mock; its own
 * specs cover the exchange and the credential.
 */
describe("Mail account linking", () => {
  const ctx = signedInApp({
    env: {
      AUTH_PUBLIC_BASE_URL: "https://api.example.com",
      AUTH_CLIENT_ORIGINS: `${SITE},http://localhost:3000`,
    },
    overrides: [{ provide: MinervaMailAgentClient, useValue: agent }],
  });

  beforeEach(() => {
    for (const fn of Object.values(agent)) fn.mockReset();
  });

  describe("without an identity", () => {
    it.each([
      ["get", `${BASE}/mail/accounts`],
      ["post", `${BASE}/mail/account/${ACCOUNT_ID}/connect`],
    ] as const)("%s %s answers 401", async (method, path) => {
      const res = await ctx.t.http()[method](path);
      expect(res.status).toBe(401);
      expect(agent.startSignIn).not.toHaveBeenCalled();
    });
  });

  describe("ListMailAccounts", () => {
    it("lists the caller's accounts, linked or not", async () => {
      ctx.t.graphql.on("ListMailAccounts", {
        minerva_mail_accounts: [
          accountRow({
            linkedTime: "2026-10-06T17:00:00Z",
            linkScope: SCOPE,
            subject: SUBJECT,
          }),
          accountRow({
            id: "7b2b0000-0000-4000-8000-000000000002",
            email: "old@example.com",
          }),
        ],
      });
      const res = await ctx.as(ctx.t.http().get(`${BASE}/mail/accounts`));
      expect(res.status).toBe(200);
      expect(res.body.accounts).toEqual([
        {
          id: ACCOUNT_ID,
          email: "neil@example.com",
          verification: "import",
          verifiedTime: "2026-10-05T12:00:00.000Z",
          linkedTime: "2026-10-06T17:00:00.000Z",
          linkScope: SCOPE,
        },
        {
          id: "7b2b0000-0000-4000-8000-000000000002",
          email: "old@example.com",
          verification: "import",
          verifiedTime: "2026-10-05T12:00:00.000Z",
        },
      ]);
      expect(JSON.stringify(res.body)).not.toContain(SUBJECT);
      expect(ctx.t.graphql.calls("ListMailAccounts")[0].variables).toEqual({
        userId: USER,
      });
    });
  });

  describe("ConnectMailAccount", () => {
    const connect = (body: object, id = ACCOUNT_ID) =>
      ctx.as(
        ctx.t.http().post(`${BASE}/mail/account/${id}/connect`).send(body),
      );

    it("starts a sign-in for the account's own mailbox", async () => {
      ctx.t.graphql
        .on("DescribeOwnedMailAccount", {
          minerva_mail_accounts: [accountRow()],
        })
        .on("CreateMailAccountConnection", {
          insert_minerva_mail_account_connections_one: { id: "c1" },
        });
      agent.startSignIn.mockResolvedValue(
        "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      );

      const res = await connect({ returnTo: RETURN_TO });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      });
      const [signIn] = agent.startSignIn.mock.calls[0];
      expect(signIn).toMatchObject({
        redirectUri: CALLBACK,
        email: "neil@example.com",
      });
      const stored = ctx.t.graphql.calls("CreateMailAccountConnection")[0]
        .variables as { connection: Record<string, unknown> };
      expect(stored.connection).toMatchObject({
        userId: USER,
        accountId: ACCOUNT_ID,
        returnTo: RETURN_TO,
        stateHash: hashState(signIn.state),
      });
      // The state itself is never stored, only its hash.
      expect(JSON.stringify(stored)).not.toContain(signIn.state);
      expect(signIn.codeChallenge).not.toBe(stored.connection.codeVerifier);
    });

    it("answers 404 for an account that is not the caller's", async () => {
      ctx.t.graphql.on("DescribeOwnedMailAccount", {
        minerva_mail_accounts: [],
      });
      const res = await connect({ returnTo: RETURN_TO });
      expect(res.status).toBe(404);
      expect(agent.startSignIn).not.toHaveBeenCalled();
    });

    it.each([
      ["no returnTo", {}],
      ["a returnTo on another site", { returnTo: "https://evil.example/" }],
      ["a returnTo that is not a URL", { returnTo: "home" }],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await connect(body);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });

    it("answers 400 to an account ID that is not one", async () => {
      const res = await connect({ returnTo: RETURN_TO }, "7b2b");
      expect(res.status).toBe(400);
    });
  });

  describe("CompleteMailAccountConnect", () => {
    const STATE = "the-state";
    const callback = (query: Record<string, string>) =>
      ctx.t.http().get(`${BASE}/mail/accounts/callback`).query(query);
    const waiting = (connection: unknown) =>
      ctx.t.graphql.on("TakeMailAccountConnection", {
        update_minerva_mail_account_connections: {
          returning: connection ? [connection] : [],
        },
      });
    const elsewhere = (taken: boolean) =>
      ctx.t.graphql
        .on("DescribeMailAccountBySubject", {
          minerva_mail_accounts: taken ? [{ id: "someone-else" }] : [],
        })
        .on("LinkMailAccount", {
          update_minerva_mail_accounts: { affected_rows: 1 },
        });
    const signedIn = (overrides = {}) =>
      agent.completeSignIn.mockResolvedValue({
        email: "neil@example.com",
        subject: SUBJECT,
        scope: SCOPE,
        created: true,
        ...overrides,
      });

    it("links the account when it is the mailbox's own", async () => {
      waiting(connectionRow());
      elsewhere(false);
      signedIn();

      const res = await callback({ state: STATE, code: "4/abc" });

      expect(res.status).toBe(302);
      expect(outcome(res.headers.location)).toEqual({
        page: RETURN_TO,
        mailAccount: "connected",
        accountId: ACCOUNT_ID,
      });
      expect(
        ctx.t.graphql.calls("TakeMailAccountConnection")[0].variables,
      ).toMatchObject({ stateHash: hashState(STATE) });
      const [redeem] = agent.completeSignIn.mock.calls[0];
      expect(redeem).toMatchObject({
        redirectUri: CALLBACK,
        state: STATE,
        codeVerifier: "verifier",
        email: "neil@example.com",
      });
      expect(redeem.callbackUrl).toContain("code=4%2Fabc");
      expect(ctx.t.graphql.calls("LinkMailAccount")[0].variables).toMatchObject(
        {
          id: ACCOUNT_ID,
          userId: USER,
          subject: SUBJECT,
          scope: SCOPE,
        },
      );
    });

    it("re-links an account to the same Google account", async () => {
      waiting(connectionRow({ account: accountRow({ subject: SUBJECT }) }));
      elsewhere(false);
      signedIn({ created: false });
      const res = await callback({ state: STATE, code: "c" });
      expect(outcome(res.headers.location).mailAccount).toBe("connected");
    });

    it("refuses another Google account than the one linked before", async () => {
      waiting(connectionRow({ account: accountRow({ subject: "another" }) }));
      elsewhere(false);
      signedIn({ created: true });
      const res = await callback({ state: STATE, code: "c" });
      expect(outcome(res.headers.location)).toMatchObject({
        mailAccount: "refused",
        reason: "another-account",
      });
      expect(ctx.t.graphql.calls("LinkMailAccount")).toHaveLength(0);
      expect(agent.deleteAccount).toHaveBeenCalledWith("neil@example.com");
    });

    it("refuses a Google account another mail account has", async () => {
      waiting(connectionRow());
      elsewhere(true);
      signedIn();
      const res = await callback({ state: STATE, code: "c" });
      expect(outcome(res.headers.location)).toMatchObject({
        mailAccount: "refused",
        reason: "owned",
      });
      expect(ctx.t.graphql.calls("LinkMailAccount")).toHaveLength(0);
    });

    it("says refused when the agent finds another mailbox signed in", async () => {
      waiting(connectionRow());
      agent.completeSignIn.mockRejectedValue(
        new ConflictException("another mailbox"),
      );
      const res = await callback({ state: STATE, code: "c" });
      expect(outcome(res.headers.location)).toMatchObject({
        mailAccount: "refused",
        reason: "another-account",
      });
    });

    it("says failed when the agent fails", async () => {
      waiting(connectionRow());
      agent.completeSignIn.mockRejectedValue(new BadGatewayException("no"));
      const res = await callback({ state: STATE, code: "c" });
      expect(outcome(res.headers.location).mailAccount).toBe("failed");
    });

    it("says cancelled when the user declined at Google", async () => {
      waiting(connectionRow());
      const res = await callback({ state: STATE, error: "access_denied" });
      expect(outcome(res.headers.location).mailAccount).toBe("cancelled");
      expect(agent.completeSignIn).not.toHaveBeenCalled();
    });

    it("says expired after ten minutes", async () => {
      waiting(
        connectionRow({
          expiresTime: new Date(Date.now() - 1000).toISOString(),
        }),
      );
      const res = await callback({ state: STATE, code: "c" });
      expect(outcome(res.headers.location).mailAccount).toBe("expired");
      expect(agent.completeSignIn).not.toHaveBeenCalled();
    });

    it("answers 400, sending the browser nowhere, for a state no sign-in has", async () => {
      waiting(null);
      const res = await callback({ state: STATE, code: "c" });
      expect(res.status).toBe(400);
      expect(res.headers.location).toBeUndefined();
    });

    it("answers 400 without a state", async () => {
      const res = await callback({ code: "c" });
      expect(res.status).toBe(400);
    });
  });
});
