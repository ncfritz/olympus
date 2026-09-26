import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as jose from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { codeChallengeFor } from "../../src/auth/codes/pkce";
import type {
  ProviderLeg,
  ProviderResult,
} from "../../src/auth/providers/ProviderLoginService";
import { ProviderLoginService } from "../../src/auth/providers/ProviderLoginService";
import { hashRefreshToken } from "../../src/auth/tokens/refreshTokens";
import { createTestApp, type TestApp } from "../support/testApp";

const USER = "ed2b62f9-0000-4000-8000-000000000001";
const SESSION = "9c2f4b1a-0000-4000-8000-0000000000aa";

/** 43 characters from RFC 7636's unreserved set. */
const VERIFIER = "a".repeat(43);
const OTHER_VERIFIER = "b".repeat(43);
const CHALLENGE = codeChallengeFor(VERIFIER);

const TESTER = "olympus-auth-tester";
const TESTER_REDIRECT = "http://127.0.0.1:8123/callback";
const SITE = "olympus-site";
const SITE_REDIRECT = "https://olympus.test/auth/callback";

const userRow = (over: Record<string, unknown> = {}) => ({
  id: USER,
  displayName: "Neil",
  email: "neil@example.com",
  disabled: false,
  roles: [{ role: "admin" }],
  ...over,
});

const identity = {
  provider: "google",
  subject: "google-subject-1",
  email: "neil@example.com",
  emailVerified: true,
};

/**
 * The provider, as this API sees it.
 *
 * Deliberately not a real identity provider. What the API owns — and can
 * get wrong — is the authorization-code store, its own PKCE check, the
 * order in which `authorize` refuses things, whether a failure is a 400 or
 * a redirect, and the session lifecycle. A fake drives all of those, plus
 * the answers a real provider will not produce on demand: an unverified
 * address, a missing subject, a refused code. openid-client's own leg is
 * exercised by signing in for real (docs/guides/signing-in.md) and by the
 * tester in phase 4.
 */
class FakeProviderLogin {
  /** What `complete` will answer with. */
  result: ProviderResult = { identity };
  /** Every `complete` call, to check what the controller passed on. */
  completed: { provider: string; url: string; leg: unknown }[] = [];
  private begins = 0;
  lastLeg?: ProviderLeg;

  callbackUrl(provider: string): string {
    return `https://olympus.test/api/v1/auth/callback/${provider}`;
  }

  begin(_provider: string): Promise<ProviderLeg> {
    this.begins += 1;
    // A fresh state each time, as openid-client's would be: a fixed one
    // would let one test's pending authorization answer another's callback.
    this.lastLeg = {
      verifier: `provider-verifier-${this.begins}`,
      nonce: `provider-nonce-${this.begins}`,
      state: `provider-state-${this.begins}`,
      url: `https://accounts.google.test/o/oauth2/v2/auth?state=provider-state-${this.begins}`,
    };
    return Promise.resolve(this.lastLeg);
  }

  complete(
    provider: string,
    url: string,
    leg: unknown,
  ): Promise<ProviderResult> {
    this.completed.push({ provider, url, leg });
    return Promise.resolve(this.result);
  }
}

/** The authorization request, as a query string. */
const authorizeQuery = (over: Record<string, string | undefined> = {}) => {
  const params: Record<string, string | undefined> = {
    client_id: TESTER,
    redirect_uri: TESTER_REDIRECT,
    response_type: "code",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    state: "client-state",
    provider: "google",
    ...over,
  };
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) query.set(name, value);
  }
  return query.toString();
};

/**
 * Signing in, end to end over HTTP: what the browser and the client do, and
 * every way each leg refuses.
 */
describe("signing in", () => {
  let t: TestApp;
  let provider: FakeProviderLogin;

  beforeAll(async () => {
    const keys = mkdtempSync(join(tmpdir(), "signin-keys-"));
    const { privateKey } = await jose.generateKeyPair("ES256", {
      extractable: true,
    });
    writeFileSync(
      join(keys, "2026-01-01.pem"),
      await jose.exportPKCS8(privateKey),
    );

    provider = new FakeProviderLogin();
    t = await createTestApp({
      env: {
        AUTH_SIGNING_KEYS: keys,
        // This spec begins a sign-in about thirty times in a few seconds,
        // which the per-caller limit of ten a minute would refuse -- rightly,
        // since nothing real does that. authRateLimits.spec covers the limits.
        AUTH_RATE_LIMITS: "off",
        AUTH_CLIENT_ORIGINS: "https://olympus.test",
        // With a path, so the refresh cookie's path has to carry it.
        AUTH_PUBLIC_BASE_URL: "https://olympus.test/api",
        AUTH_OIDC_PROVIDERS: JSON.stringify([
          {
            name: "google",
            issuer: "https://accounts.google.com",
            clientId: "client-id",
            clientSecret: "client-secret",
          },
        ]),
      },
      overrides: [{ provide: ProviderLoginService, useValue: provider }],
    });
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(() => {
    t.reset();
    provider.result = { identity };
    provider.completed = [];
  });

  /** Begins a sign-in and returns the state the provider would come back with. */
  const begin = async (over: Record<string, string | undefined> = {}) => {
    const res = await t
      .http()
      .get(`/v1/auth/authorize?${authorizeQuery(over)}`);
    expect(res.status).toBe(302);
    return provider.lastLeg!.state;
  };

  /** Walks authorize and callback, and returns the code the client receives. */
  const codeFor = async (over: Record<string, string | undefined> = {}) => {
    t.graphql.on("DescribeUserByIdentity", {
      olympus_user_identities: [{ user: userRow() }],
    });
    const state = await begin(over);
    const res = await t
      .http()
      .get(`/v1/auth/callback/google?state=${state}&code=provider-code`);
    expect(res.status).toBe(302);
    const target = new URL(res.headers.location as string);
    const code = target.searchParams.get("code");
    expect(code).not.toBeNull();
    return code as string;
  };

  describe("authorize", () => {
    it("redirects to the provider", async () => {
      const res = await t.http().get(`/v1/auth/authorize?${authorizeQuery()}`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(provider.lastLeg?.url);
    });

    it.each([
      ["an unknown client", { client_id: "nobody" }],
      ["no client at all", { client_id: undefined }],
      [
        "a redirect_uri the client did not register",
        {
          redirect_uri: "https://elsewhere.test/callback",
        },
      ],
      // localhost is deliberately not loopback: it resolves through
      // whatever the machine's resolver says.
      [
        "a loopback URI by name rather than address",
        {
          redirect_uri: "http://localhost:8123/callback",
        },
      ],
      ["a response_type we do not support", { response_type: "token" }],
      ["a PKCE method we do not support", { code_challenge_method: "plain" }],
      ["a challenge that is not S256-shaped", { code_challenge: "short" }],
      ["no challenge", { code_challenge: undefined }],
      ["no state", { state: undefined }],
      ["an unknown provider", { provider: "myspace" }],
    ])("refuses %s with 400 and never a redirect", async (_what, over) => {
      const res = await t
        .http()
        .get(`/v1/auth/authorize?${authorizeQuery(over)}`);
      expect(res.status).toBe(400);
      // The whole reason the checks are ordered as they are: bouncing the
      // browser to an unvalidated redirect_uri is an open redirect.
      expect(res.headers.location).toBeUndefined();
    });
  });

  describe("the provider's callback", () => {
    it("redirects to the client with a code and the client's own state", async () => {
      t.graphql.on("DescribeUserByIdentity", {
        olympus_user_identities: [{ user: userRow() }],
      });
      const state = await begin();
      const res = await t
        .http()
        .get(`/v1/auth/callback/google?state=${state}&code=provider-code`);

      expect(res.status).toBe(302);
      const target = new URL(res.headers.location as string);
      expect(`${target.origin}${target.pathname}`).toBe(TESTER_REDIRECT);
      expect(target.searchParams.get("code")).toBeTruthy();
      // Untouched: it is how the client knows this is the sign-in it started.
      expect(target.searchParams.get("state")).toBe("client-state");
      expect(target.searchParams.get("error")).toBeNull();
    });

    it("gives the provider the callback's own URL and the stored leg", async () => {
      t.graphql.on("DescribeUserByIdentity", {
        olympus_user_identities: [{ user: userRow() }],
      });
      const state = await begin();
      const leg = provider.lastLeg!;
      await t
        .http()
        .get(`/v1/auth/callback/google?state=${state}&code=provider-code`);

      expect(provider.completed).toHaveLength(1);
      expect(provider.completed[0]?.provider).toBe("google");
      // The same URL the provider was given as redirect_uri, query and all:
      // the token exchange sends it again and the two are compared.
      expect(provider.completed[0]?.url).toBe(
        `/v1/auth/callback/google?state=${state}&code=provider-code`,
      );
      expect(provider.completed[0]?.leg).toEqual({
        verifier: leg.verifier,
        nonce: leg.nonce,
        state: leg.state,
      });
    });

    it("links the identity by verified email the first time", async () => {
      t.graphql
        .on("DescribeUserByIdentity", { olympus_user_identities: [] })
        .on("DescribeUserByEmail", { olympus_users: [userRow()] })
        .on("CreateUserIdentity", {
          insert_olympus_user_identities_one: { id: "link-1" },
        });
      const state = await begin();
      const res = await t
        .http()
        .get(`/v1/auth/callback/google?state=${state}&code=provider-code`);

      expect(res.status).toBe(302);
      expect(t.graphql.calls("CreateUserIdentity")[0]?.variables).toMatchObject(
        { userId: USER, provider: "google", subject: identity.subject },
      );
    });

    it.each([
      ["there is no pending sign-in for that state", "never-issued"],
      ["state is empty", ""],
    ])("answers 400 when %s", async (_what, state) => {
      const res = await t.http().get(`/v1/auth/callback/google?state=${state}`);
      // Nothing to bounce to: no pending authorization means no validated
      // redirect_uri.
      expect(res.status).toBe(400);
      expect(res.headers.location).toBeUndefined();
    });

    it("answers 400 when the state belongs to another provider", async () => {
      const state = await begin();
      const res = await t
        .http()
        .get(`/v1/auth/callback/synology?state=${state}&code=x`);
      expect(res.status).toBe(400);
    });

    it("answers 400 to a replayed callback", async () => {
      t.graphql.on("DescribeUserByIdentity", {
        olympus_user_identities: [{ user: userRow() }],
      });
      const state = await begin();
      const url = `/v1/auth/callback/google?state=${state}&code=provider-code`;
      expect((await t.http().get(url)).status).toBe(302);
      // Taking the pending authorization removed it.
      expect((await t.http().get(url)).status).toBe(400);
    });

    it.each([
      [
        "the person declined at the provider",
        undefined,
        "&error=access_denied",
      ],
      [
        "the provider refused the code",
        { reason: "the provider did not accept the code" },
        "",
      ],
      [
        "the address was not verified",
        { reason: "google did not verify neil@example.com" },
        "",
      ],
      [
        "there is no user with that address",
        { reason: "no user with the email google gave" },
        "",
      ],
    ])(
      "redirects with error=access_denied when %s",
      async (_what, result, extra) => {
        t.graphql.on("DescribeUserByIdentity", {
          olympus_user_identities: [{ user: userRow() }],
        });
        if (result !== undefined) provider.result = result as ProviderResult;
        const state = await begin();
        const res = await t
          .http()
          .get(`/v1/auth/callback/google?state=${state}${extra}`);

        expect(res.status).toBe(302);
        const target = new URL(res.headers.location as string);
        expect(target.searchParams.get("error")).toBe("access_denied");
        expect(target.searchParams.get("code")).toBeNull();
        expect(target.searchParams.get("state")).toBe("client-state");
        // The reason is a log line, never a query parameter: the difference
        // between "no such user" and "bad code" tells an attacker whether an
        // address is one of ours.
        expect(res.headers.location).not.toContain("reason");
        expect(res.headers.location).not.toContain("error_description");
      },
    );

    it("redirects with access_denied for a disabled user", async () => {
      t.graphql.on("DescribeUserByIdentity", {
        olympus_user_identities: [{ user: userRow({ disabled: true }) }],
      });
      const state = await begin();
      const res = await t
        .http()
        .get(`/v1/auth/callback/google?state=${state}&code=provider-code`);
      expect(
        new URL(res.headers.location as string).searchParams.get("error"),
      ).toBe("access_denied");
    });
  });

  describe("exchanging the code", () => {
    const sessionCreated = () =>
      t.graphql
        .on("DescribeUser", { olympus_users_by_pk: userRow() })
        .on("CreateSession", {
          insert_olympus_sessions_one: {
            id: SESSION,
            createdTime: "2026-09-26T03:37:24+00:00",
          },
        });

    it("returns an access token with the claims we issue", async () => {
      const code = await codeFor();
      sessionCreated();
      const res = await t.http().post("/v1/auth/token").type("form").send({
        grant_type: "authorization_code",
        code,
        redirect_uri: TESTER_REDIRECT,
        client_id: TESTER,
        code_verifier: VERIFIER,
        device_name: "a test",
      });

      expect(res.status).toBe(200);
      expect(res.body.token_type).toBe("Bearer");
      expect(res.body.expires_in).toBe(600);
      const claims = jose.decodeJwt(res.body.access_token as string);
      expect(claims.sub).toBe(USER);
      expect(claims.aud).toBe("olympus-api");
      expect(claims.client_id).toBe(TESTER);
      expect(claims.sid).toBe(SESSION);
      // The roles the directory holds now, not any carried in the code.
      expect(claims.roles).toEqual(["admin"]);
      // The session's creation, so refresh can carry it unchanged.
      expect(claims.auth_time).toBe(
        Math.floor(new Date("2026-09-26T03:37:24+00:00").getTime() / 1000),
      );
    });

    it("gives this client its refresh token in the body", async () => {
      const code = await codeFor();
      sessionCreated();
      const res = await t.http().post("/v1/auth/token").type("form").send({
        grant_type: "authorization_code",
        code,
        redirect_uri: TESTER_REDIRECT,
        client_id: TESTER,
        code_verifier: VERIFIER,
      });
      expect(res.body.refresh_token).toBeTruthy();
      expect(res.headers["set-cookie"]).toBeUndefined();
      // What is stored is the hash, never the token.
      expect(t.graphql.calls("CreateSession")[0]?.variables).toMatchObject({
        refreshTokenHash: hashRefreshToken(res.body.refresh_token as string),
      });
    });

    it("gives the site its refresh token in an httpOnly cookie instead", async () => {
      const code = await codeFor({
        client_id: SITE,
        redirect_uri: SITE_REDIRECT,
      });
      sessionCreated();
      const res = await t.http().post("/v1/auth/token").type("form").send({
        grant_type: "authorization_code",
        code,
        redirect_uri: SITE_REDIRECT,
        client_id: SITE,
        code_verifier: VERIFIER,
      });

      expect(res.status).toBe(200);
      // Never in the body: a refresh token in a field is one a script read.
      expect(res.body.refresh_token).toBeUndefined();
      // supertest types every header as a string; set-cookie is a list.
      const cookies = res.headers["set-cookie"] as unknown as string[];
      const cookie = cookies[0]!;
      expect(cookie).toContain("olympus_refresh=");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Strict");
      // AUTH_PUBLIC_BASE_URL carries /api, so the cookie's path has to, or
      // the browser never sends it to the endpoint that needs it.
      expect(cookie).toContain("Path=/api/v1/auth");
    });

    it("refuses the wrong verifier, and the code is spent either way", async () => {
      const code = await codeFor();
      const attempt = (verifier: string) =>
        t.http().post("/v1/auth/token").type("form").send({
          grant_type: "authorization_code",
          code,
          redirect_uri: TESTER_REDIRECT,
          client_id: TESTER,
          code_verifier: verifier,
        });

      const wrong = await attempt(OTHER_VERIFIER);
      expect(wrong.status).toBe(400);
      expect(wrong.body).toEqual({
        error: "invalid_grant",
        error_description: "the code is not valid",
      });
      // One attempt each: redeeming consumes the code even when it fails.
      expect((await attempt(VERIFIER)).status).toBe(400);
    });

    it.each([
      ["another client presents it", { client_id: SITE }],
      [
        "the redirect_uri is not the one it was issued for",
        {
          redirect_uri: "http://127.0.0.1:9999/callback",
        },
      ],
    ])("refuses the code when %s", async (_what, over) => {
      const code = await codeFor();
      const res = await t
        .http()
        .post("/v1/auth/token")
        .type("form")
        .send({
          grant_type: "authorization_code",
          code,
          redirect_uri: TESTER_REDIRECT,
          client_id: TESTER,
          code_verifier: VERIFIER,
          ...over,
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it("refuses a code that was never issued", async () => {
      const res = await t.http().post("/v1/auth/token").type("form").send({
        grant_type: "authorization_code",
        code: "not-a-code",
        redirect_uri: TESTER_REDIRECT,
        client_id: TESTER,
        code_verifier: VERIFIER,
      });
      expect(res.body.error).toBe("invalid_grant");
    });

    it.each([
      [
        "an unsupported grant",
        { grant_type: "password" },
        "unsupported_grant_type",
      ],
      ["no grant at all", { grant_type: undefined }, "unsupported_grant_type"],
      ["a missing field", { code_verifier: undefined }, "invalid_request"],
    ])("answers RFC 6749's shape for %s", async (_what, over, error) => {
      const body: Record<string, string> = {
        grant_type: "authorization_code",
        code: "whatever",
        redirect_uri: TESTER_REDIRECT,
        client_id: TESTER,
        code_verifier: VERIFIER,
      };
      for (const [name, value] of Object.entries(over)) {
        if (value === undefined) delete body[name];
        else body[name] = value as string;
      }
      const res = await t.http().post("/v1/auth/token").type("form").send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(error);
      expect(typeof res.body.error_description).toBe("string");
    });
  });

  describe("refreshing", () => {
    const session = (over: Record<string, unknown> = {}) => ({
      id: SESSION,
      userId: USER,
      clientId: TESTER,
      createdTime: "2026-09-26T03:37:24+00:00",
      expiresTime: "2026-10-26T03:37:24+00:00",
      revokedTime: null,
      ...over,
    });

    /** A session whose current token is `current` and previous `previous`. */
    const sessionsByHash = (
      current: string,
      previous: string | undefined,
      row: Record<string, unknown> = {},
    ) =>
      t.graphql.on("DescribeSessionByRefreshToken", (variables) => {
        const hash = (variables as { hash: string }).hash;
        if (hash === current) {
          return { current: [session(row)], previous: [] };
        }
        if (previous !== undefined && hash === previous) {
          return { current: [], previous: [session(row)] };
        }
        return { current: [], previous: [] };
      });

    /** Signs in and returns the refresh token the client was given. */
    const signedIn = async () => {
      const code = await codeFor();
      t.graphql
        .on("DescribeUser", { olympus_users_by_pk: userRow() })
        .on("CreateSession", {
          insert_olympus_sessions_one: {
            id: SESSION,
            createdTime: "2026-09-26T03:37:24+00:00",
          },
        });
      const res = await t.http().post("/v1/auth/token").type("form").send({
        grant_type: "authorization_code",
        code,
        redirect_uri: TESTER_REDIRECT,
        client_id: TESTER,
        code_verifier: VERIFIER,
      });
      expect(res.status).toBe(200);
      return res.body.refresh_token as string;
    };

    const refresh = (token: string) =>
      t.http().post("/v1/auth/token").type("form").send({
        grant_type: "refresh_token",
        client_id: TESTER,
        refresh_token: token,
      });

    it("rotates the token and keeps the session", async () => {
      const first = await signedIn();
      sessionsByHash(hashRefreshToken(first), undefined);
      t.graphql.on("RotateSession", {
        update_olympus_sessions: { affected_rows: 1 },
      });

      const res = await refresh(first);
      expect(res.status).toBe(200);
      expect(res.body.refresh_token).toBeTruthy();
      expect(res.body.refresh_token).not.toBe(first);

      const claims = jose.decodeJwt(res.body.access_token as string);
      // The same session, and the same auth_time: rotating a token does not
      // begin a session, and it does not prove a fresh sign-in.
      expect(claims.sid).toBe(SESSION);
      expect(claims.auth_time).toBe(
        Math.floor(new Date("2026-09-26T03:37:24+00:00").getTime() / 1000),
      );
      expect(t.graphql.calls("RotateSession")[0]?.variables).toMatchObject({
        id: SESSION,
        expected: hashRefreshToken(first),
      });
    });

    it("revokes the session when a rotated token is presented again", async () => {
      const first = await signedIn();
      sessionsByHash(hashRefreshToken(first), undefined);
      t.graphql.on("RotateSession", {
        update_olympus_sessions: { affected_rows: 1 },
      });
      const second = (await refresh(first)).body.refresh_token as string;

      // Now the first is the *previous* hash, which is reuse by ADR 0018's
      // definition: either a theft or the client racing itself, and the two
      // are indistinguishable.
      sessionsByHash(hashRefreshToken(second), hashRefreshToken(first));
      t.graphql.on("RevokeSession", {
        update_olympus_sessions: { affected_rows: 1 },
      });

      const replay = await refresh(first);
      expect(replay.status).toBe(400);
      expect(replay.body.error).toBe("invalid_grant");
      expect(t.graphql.calls("RevokeSession")[0]?.variables).toMatchObject({
        id: SESSION,
      });
    });

    it("refuses a token nothing knows about", async () => {
      t.graphql.on("DescribeSessionByRefreshToken", {
        current: [],
        previous: [],
      });
      const res = await refresh("made-up");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_grant");
    });

    it.each([
      ["already revoked", { revokedTime: "2026-09-26T04:00:00+00:00" }],
      ["expired", { expiresTime: "2026-09-01T00:00:00+00:00" }],
      ["issued to another client", { clientId: SITE }],
    ])("refuses a session that is %s", async (_what, row) => {
      const token = "some-refresh-token";
      sessionsByHash(hashRefreshToken(token), undefined, row);
      const res = await refresh(token);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_grant");
      // Nothing rotated: the session was never eligible.
      expect(t.graphql.calls("RotateSession")).toEqual([]);
    });

    it("refuses, and revokes, when the user has been disabled", async () => {
      const token = "another-refresh-token";
      sessionsByHash(hashRefreshToken(token), undefined);
      t.graphql
        .on("DescribeUser", {
          olympus_users_by_pk: userRow({ disabled: true }),
        })
        .on("RevokeSession", {
          update_olympus_sessions: { affected_rows: 1 },
        });

      const res = await refresh(token);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_grant");
      // Their sessions end here rather than at expiry.
      expect(t.graphql.calls("RevokeSession")).toHaveLength(1);
    });

    it("refuses when a rotation raced and lost", async () => {
      const token = "raced-refresh-token";
      sessionsByHash(hashRefreshToken(token), undefined);
      t.graphql
        .on("DescribeUser", { olympus_users_by_pk: userRow() })
        // Someone else rotated between the lookup and the update.
        .on("RotateSession", {
          update_olympus_sessions: { affected_rows: 0 },
        });
      const res = await refresh(token);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_grant");
    });
  });
});
