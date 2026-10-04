import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { generateKeyPairSync } from "crypto";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { AppModule } from "../../src/AppModule";
import { configureApp } from "../../src/configureApp";
import { E2E_USER_ID, issueE2eAccessToken } from "./auth-fixtures";
import { olympus } from "./olympus-fake";

const WEB_APP_URL = "http://console.test/minerva/calendar";
const ISSUED = {
  access_token: "",
  token_type: "Bearer",
  expires_in: 600,
  refresh_token: "refresh-2",
};

/** The cookies a response sets, by name: value and attributes. */
const setCookies = (res: request.Response): Record<string, string> => {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  return Object.fromEntries(
    (header ?? []).map((cookie) => {
      const [pair] = cookie.split(";");
      const at = pair.indexOf("=");
      return [pair.slice(0, at), cookie];
    }),
  );
};

/**
 * Signing in through Olympus (ADR 0029), against a fake of the API: its
 * published keys, its token endpoint, and who it says the user is.
 */
describe("Auth (e2e)", () => {
  let app: INestApplication;

  beforeAll(() => {
    process.env.WEB_APP_URL = WEB_APP_URL;
  });

  afterAll(() => {
    delete process.env.WEB_APP_URL;
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe("checking tokens", () => {
    it("GET /v1/auth/current-user describes the user as Olympus does", async () => {
      olympus.answer("GET /v1/auth/me", {
        status: 200,
        body: {
          user: {
            id: E2E_USER_ID,
            displayName: "Neil",
            email: "neil@example.com",
            roles: ["admin"],
          },
        },
      });
      const token = issueE2eAccessToken();

      const res = await http()
        .get("/v1/auth/current-user")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ user: { email: "neil@example.com" } });
      const [asked] = olympus.requests("GET /v1/auth/me");
      expect(asked?.headers.authorization).toBe(`Bearer ${token}`);
      expect(asked?.headers["x-olympus-client"]).toBe(
        "minerva-calendar-console",
      );
    });

    it("refuses a user without the admin role", async () => {
      await http()
        .get("/v1/calendars")
        .set(
          "Authorization",
          `Bearer ${issueE2eAccessToken({ roles: ["user"] })}`,
        )
        .expect(403);
    });

    it("refuses an expired token", async () => {
      const expired = issueE2eAccessToken({
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      await http()
        .get("/v1/calendars")
        .set("Authorization", `Bearer ${expired}`)
        .expect(401);
    });

    it("refuses a token signed with a key Olympus did not publish", async () => {
      const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
      await http()
        .get("/v1/calendars")
        .set("Authorization", `Bearer ${olympus.token({}, privateKey)}`)
        .expect(401);
    });

    it("refuses a malformed token", async () => {
      await http()
        .get("/v1/calendars")
        .set("Authorization", "Bearer not-a-real-token")
        .expect(401);
    });
  });

  describe("signing in", () => {
    it("sends the browser to Olympus's sign-in as this console", async () => {
      const res = await http()
        .get("/auth/login/google")
        .query({ returnTo: `${WEB_APP_URL}/sync` })
        .expect(302);

      const location = new URL(res.headers.location);
      expect(`${location.origin}${location.pathname}`).toBe(
        `${olympus.url}/v1/auth/authorize`,
      );
      expect(Object.fromEntries(location.searchParams)).toEqual({
        client_id: "minerva-calendar-console",
        redirect_uri: "http://localhost:4432/auth/callback",
        response_type: "code",
        code_challenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        code_challenge_method: "S256",
        state: expect.any(String),
        provider: "google",
      });
      const txn = setCookies(res).minerva_sign_in_txn;
      expect(txn).toContain("HttpOnly");
    });

    const begin = async () => {
      const res = await http()
        .get("/auth/login/google")
        .query({ returnTo: `${WEB_APP_URL}/sync` });
      const state = new URL(res.headers.location).searchParams.get("state")!;
      const cookie = setCookies(res).minerva_sign_in_txn!.split(";")[0];
      return { state, cookie };
    };

    it("completes the sign-in and sets both session cookies", async () => {
      const token = issueE2eAccessToken();
      olympus.answer("POST /v1/auth/token", {
        status: 200,
        body: { ...ISSUED, access_token: token },
      });
      const { state, cookie } = await begin();

      const res = await http()
        .get("/auth/callback")
        .query({ code: "the-code", state })
        .set("Cookie", cookie)
        .expect(302);

      expect(res.headers.location).toBe(`${WEB_APP_URL}/sync`);
      const cookies = setCookies(res);
      expect(cookies.minerva_access_token).toContain(
        `minerva_access_token=${token}`,
      );
      expect(cookies.minerva_access_token).toContain("HttpOnly");
      expect(cookies.minerva_access_token).toContain("Path=/minerva/calendar");
      expect(cookies.minerva_refresh_token).toContain(
        "minerva_refresh_token=refresh-2",
      );
      expect(cookies.minerva_refresh_token).toContain("HttpOnly");

      const [exchange] = olympus.requests("POST /v1/auth/token");
      const form = Object.fromEntries(new URLSearchParams(exchange!.body));
      expect(form).toEqual({
        grant_type: "authorization_code",
        code: "the-code",
        redirect_uri: "http://localhost:4432/auth/callback",
        client_id: "minerva-calendar-console",
        code_verifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        device_name: "Minerva calendar console",
      });
    });

    it("refuses a callback whose state is not the sign-in's", async () => {
      const { cookie } = await begin();

      await http()
        .get("/auth/callback")
        .query({ code: "the-code", state: "someone-elses" })
        .set("Cookie", cookie)
        .expect(400);
      expect(olympus.requests("POST /v1/auth/token")).toHaveLength(0);
    });

    it("refuses a callback with no sign-in under way", async () => {
      await http()
        .get("/auth/callback")
        .query({ code: "the-code", state: "s" })
        .expect(400);
    });

    it("reports a code Olympus will not exchange", async () => {
      olympus.answer("POST /v1/auth/token", {
        status: 400,
        body: {
          error: "invalid_grant",
          error_description: "the code is not valid",
        },
      });
      const { state, cookie } = await begin();

      const res = await http()
        .get("/auth/callback")
        .query({ code: "stale", state })
        .set("Cookie", cookie)
        .expect(400);
      expect(res.body.message).toMatch(/invalid_grant/);
    });
  });

  describe("the console's session", () => {
    it("refreshes an expired access token once for requests made together", async () => {
      const fresh = issueE2eAccessToken();
      olympus.answer("POST /v1/auth/token", {
        status: 200,
        body: { ...ISSUED, access_token: fresh },
      });
      const expired = issueE2eAccessToken({
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      const cookie = `minerva_access_token=${expired}; minerva_refresh_token=refresh-1`;

      const answers = await Promise.all(
        [1, 2, 3].map(() => http().get("/v1/calendars").set("Cookie", cookie)),
      );

      expect(answers.map((res) => res.status)).toEqual([200, 200, 200]);
      for (const res of answers) {
        expect(setCookies(res).minerva_access_token).toContain(fresh);
        expect(setCookies(res).minerva_refresh_token).toContain("refresh-2");
      }
      const refreshes = olympus.requests("POST /v1/auth/token");
      expect(refreshes).toHaveLength(1);
      expect(
        Object.fromEntries(new URLSearchParams(refreshes[0]!.body)),
      ).toEqual({
        grant_type: "refresh_token",
        client_id: "minerva-calendar-console",
        refresh_token: "refresh-1",
      });
    });

    it("clears the cookies when Olympus has ended the session", async () => {
      olympus.answer("POST /v1/auth/token", {
        status: 400,
        body: { error: "invalid_grant" },
      });

      const res = await http()
        .get("/v1/calendars")
        .set("Cookie", "minerva_refresh_token=revoked")
        .expect(401);

      expect(setCookies(res).minerva_access_token).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
      expect(setCookies(res).minerva_refresh_token).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
    });

    it("POST /v1/auth/logout ends the Olympus session and clears the cookies", async () => {
      olympus.answer("POST /v1/auth/logout", {
        status: 200,
        body: { signedOut: true },
      });
      const token = issueE2eAccessToken();

      const res = await http()
        .post("/v1/auth/logout")
        .set("Cookie", `minerva_access_token=${token}; minerva_refresh_token=r`)
        .expect(204);

      const [signOut] = olympus.requests("POST /v1/auth/logout");
      expect(signOut?.headers.authorization).toBe(`Bearer ${token}`);
      expect(setCookies(res).minerva_access_token).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
      expect(setCookies(res).minerva_refresh_token).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
    });

    it("POST /v1/auth/logout clears the cookies even when Olympus cannot be asked", async () => {
      const res = await http().post("/v1/auth/logout").expect(204);
      expect(olympus.requests("POST /v1/auth/logout")).toHaveLength(0);
      expect(setCookies(res).minerva_access_token).toBeDefined();
    });
  });
});
