import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as jose from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { issueAccessToken } from "../../src/auth/tokens/accessTokens";
import { SigningKeyService } from "../../src/auth/tokens/SigningKeyService";
import { createTestApp, type TestApp } from "../support/testApp";

const USER = "5f1a0c6e-0000-4000-8000-000000000001";
const OTHER_USER = "5f1a0c6e-0000-4000-8000-0000000000ff";
const SESSION = "9c2f4b1a-0000-4000-8000-0000000000aa";
const OTHER_SESSION = "9c2f4b1a-0000-4000-8000-0000000000bb";

const userRow = (over: Record<string, unknown> = {}) => ({
  id: USER,
  displayName: "Neil",
  email: "Neil@Example.com",
  disabled: false,
  roles: [{ role: "user" }],
  ...over,
});

const sessionRow = (over: Record<string, unknown> = {}) => ({
  id: SESSION,
  userId: USER,
  clientId: "olympus-site",
  deviceName: "Neil's laptop",
  createdTime: "2026-09-24T12:00:00+00:00",
  lastUsedTime: "2026-09-25T09:00:00+00:00",
  expiresTime: "2026-10-24T12:00:00+00:00",
  revokedTime: null,
  ...over,
});

/**
 * The three endpoints a signed-in user has, over the real HTTP stack: the
 * guard, the routing and the serialization, not just the services beneath.
 *
 * The sign-in flow itself (authorize, callback, token, PKCE, reuse
 * detection) is phase 3's test item and is not covered here.
 */
describe("the signed-in user's own endpoints", () => {
  let t: TestApp;
  let token: string;

  /** A token for whichever user and session a test wants. */
  const tokenFor = async (claims: {
    sub?: string;
    sessionId?: string;
    roles?: string[];
  }) =>
    issueAccessToken(t.app.get(SigningKeyService).require(), {
      sub: claims.sub ?? USER,
      clientId: "olympus-site",
      sessionId: claims.sessionId ?? SESSION,
      // Deliberately not the roles Hasura will return: DescribeCurrentUser
      // must answer with the directory's, not the token's.
      roles: claims.roles ?? ["stale-role"],
      authTime: 1_790_000_000,
    });

  beforeAll(async () => {
    const keys = mkdtempSync(join(tmpdir(), "auth-keys-"));
    const { privateKey } = await jose.generateKeyPair("ES256", {
      extractable: true,
    });
    writeFileSync(
      join(keys, "2026-01-01.pem"),
      await jose.exportPKCS8(privateKey),
    );
    process.env.AUTH_SIGNING_KEYS = keys;

    t = await createTestApp();
    token = await tokenFor({});
  });

  afterAll(async () => {
    await t.app.close();
    delete process.env.AUTH_SIGNING_KEYS;
  });

  beforeEach(() => t.reset());

  describe("DescribeCurrentUser", () => {
    it("answers with the roles the directory holds, not the token's", async () => {
      t.graphql.on("DescribeUser", { olympus_users_by_pk: userRow() });
      const res = await t
        .http()
        .get("/v1/auth/me")
        .set("authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        user: {
          id: USER,
          displayName: "Neil",
          // The casing as stored: addresses are matched case-insensitively,
          // so this is for display.
          email: "Neil@Example.com",
          roles: ["user"],
        },
      });
    });

    it("refuses a request with no token, even in report mode", async () => {
      // The whole reason @RequiresIdentity exists. AUTH_MODE_USERS is unset,
      // so the listener is reporting; every other endpoint would serve this.
      const res = await t.http().get("/v1/auth/me");
      expect(res.status).toBe(401);
    });

    it("refuses a token whose user has since been disabled", async () => {
      t.graphql.on("DescribeUser", {
        olympus_users_by_pk: userRow({ disabled: true }),
      });
      const res = await t
        .http()
        .get("/v1/auth/me")
        .set("authorization", `Bearer ${token}`);
      // 401 rather than 403: the credentials are what is no longer good.
      expect(res.status).toBe(401);
    });

    it("refuses a token whose user no longer exists", async () => {
      t.graphql.on("DescribeUser", { olympus_users_by_pk: null });
      const res = await t
        .http()
        .get("/v1/auth/me")
        .set("authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
    });
  });

  describe("ListSessions", () => {
    it("asks Hasura for the token's own user and nobody else", async () => {
      t.graphql.on("ListSessions", { olympus_sessions: [] });
      await t
        .http()
        .get("/v1/auth/sessions")
        .set("authorization", `Bearer ${token}`)
        .expect(200);
      expect(t.graphql.calls("ListSessions")[0]?.variables).toMatchObject({
        userId: USER,
      });
    });

    it("marks the session the request came from", async () => {
      t.graphql.on("ListSessions", {
        olympus_sessions: [
          sessionRow(),
          sessionRow({ id: OTHER_SESSION, deviceName: "iPhone" }),
        ],
      });
      const res = await t
        .http()
        .get("/v1/auth/sessions")
        .set("authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(
        res.body.sessions.map((s: { id: string; current: boolean }) => [
          s.id,
          s.current,
        ]),
      ).toEqual([
        [SESSION, true],
        [OTHER_SESSION, false],
      ]);
    });

    it("publishes timestamps as ISO-8601 and nothing about the token", async () => {
      t.graphql.on("ListSessions", { olympus_sessions: [sessionRow()] });
      const res = await t
        .http()
        .get("/v1/auth/sessions")
        .set("authorization", `Bearer ${token}`);
      expect(res.body.sessions[0]).toEqual({
        id: SESSION,
        clientId: "olympus-site",
        deviceName: "Neil's laptop",
        current: true,
        createdTime: "2026-09-24T12:00:00.000Z",
        lastUsedTime: "2026-09-25T09:00:00.000Z",
        expiresTime: "2026-10-24T12:00:00.000Z",
      });
    });

    it("leaves out a device name and a last use it does not have", async () => {
      t.graphql.on("ListSessions", {
        olympus_sessions: [
          sessionRow({ deviceName: null, lastUsedTime: null }),
        ],
      });
      const res = await t
        .http()
        .get("/v1/auth/sessions")
        .set("authorization", `Bearer ${token}`);
      expect(res.body.sessions[0]).not.toHaveProperty("deviceName");
      expect(res.body.sessions[0]).not.toHaveProperty("lastUsedTime");
    });

    it("refuses a request with no token", async () => {
      expect((await t.http().get("/v1/auth/sessions")).status).toBe(401);
    });
  });

  describe("SignOut", () => {
    const revoked = (affected: number) =>
      t.graphql.on("RevokeSessionForUser", {
        update_olympus_sessions: { affected_rows: affected },
      });

    /** The Set-Cookie header for the refresh cookie, if there is one. */
    const refreshCookie = (res: { headers: Record<string, unknown> }) =>
      ((res.headers["set-cookie"] as string[] | undefined) ?? []).find(
        (cookie) => cookie.startsWith("olympus_refresh="),
      );

    it("revokes the session its own token was issued from", async () => {
      revoked(1);
      const res = await t
        .http()
        .post("/v1/auth/logout")
        .set("authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ signedOut: true });
      // From the token's sid and sub, not from anything in the request.
      expect(
        t.graphql.calls("RevokeSessionForUser")[0]?.variables,
      ).toMatchObject({ id: SESSION, userId: USER });
    });

    it("clears the refresh cookie on the path it was set with", async () => {
      // The reason this endpoint exists rather than being RevokeSession on
      // your own sid: a browser only replaces a cookie when the name,
      // domain and path match, so a cookie cleared on the wrong path stays
      // put and the site keeps presenting a revoked token.
      revoked(1);
      const cookie = refreshCookie(
        await t
          .http()
          .post("/v1/auth/logout")
          .set("authorization", `Bearer ${token}`),
      );
      expect(cookie).toBeDefined();
      expect(cookie).toContain("Path=/v1/auth");
      expect(cookie).toContain("HttpOnly");
      // Emptied and expired in the past: that is what clearing is.
      expect(cookie).toMatch(/^olympus_refresh=;/);
      expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
    });

    it("clears the cookie even when the session had already ended", async () => {
      // Otherwise signing out of an expired session leaves the dead cookie
      // behind, which is the failure worth avoiding.
      revoked(0);
      const res = await t
        .http()
        .post("/v1/auth/logout")
        .set("authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ signedOut: false });
      expect(refreshCookie(res)).toBeDefined();
    });

    it("refuses a request with no token, and touches nothing", async () => {
      const res = await t.http().post("/v1/auth/logout");
      expect(res.status).toBe(401);
      expect(t.graphql.calls("RevokeSessionForUser")).toEqual([]);
      expect(refreshCookie(res)).toBeUndefined();
    });
  });

  describe("RevokeSession", () => {
    const revoked = (affected: number) =>
      t.graphql.on("RevokeSessionForUser", {
        update_olympus_sessions: { affected_rows: affected },
      });

    it("scopes the revocation to the token's own user", async () => {
      revoked(1);
      await t
        .http()
        .delete(`/v1/auth/sessions/${OTHER_SESSION}`)
        .set("authorization", `Bearer ${token}`)
        .expect(200);
      expect(
        t.graphql.calls("RevokeSessionForUser")[0]?.variables,
      ).toMatchObject({ id: OTHER_SESSION, userId: USER });
    });

    it("says when the caller revoked some other device", async () => {
      revoked(1);
      const res = await t
        .http()
        .delete(`/v1/auth/sessions/${OTHER_SESSION}`)
        .set("authorization", `Bearer ${token}`);
      expect(res.body).toEqual({
        sessionId: OTHER_SESSION,
        signedOutThisDevice: false,
      });
    });

    it("says when the caller signed itself out", async () => {
      revoked(1);
      const res = await t
        .http()
        .delete(`/v1/auth/sessions/${SESSION}`)
        .set("authorization", `Bearer ${token}`);
      // What tells the client to throw its own tokens away.
      expect(res.body).toEqual({
        sessionId: SESSION,
        signedOutThisDevice: true,
      });
    });

    it("answers 404 for a session that is not the caller's", async () => {
      // Hasura matched no row because userId did not match. Indistinguishable
      // from a session that does not exist, on purpose.
      revoked(0);
      const res = await t
        .http()
        .delete(`/v1/auth/sessions/${OTHER_SESSION}`)
        .set("authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it("does not reach Hasura at all without a token", async () => {
      const res = await t.http().delete(`/v1/auth/sessions/${SESSION}`);
      expect(res.status).toBe(401);
      expect(t.graphql.calls("RevokeSessionForUser")).toEqual([]);
    });

    it("refuses a token for a different user than the session's owner", async () => {
      // The token decides whose sessions these are, so a token for someone
      // else simply matches nothing.
      revoked(0);
      const theirs = await tokenFor({ sub: OTHER_USER });
      const res = await t
        .http()
        .delete(`/v1/auth/sessions/${SESSION}`)
        .set("authorization", `Bearer ${theirs}`);
      expect(res.status).toBe(404);
      expect(
        t.graphql.calls("RevokeSessionForUser")[0]?.variables,
      ).toMatchObject({ userId: OTHER_USER });
    });
  });
});
