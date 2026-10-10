import type { INestApplication } from "@nestjs/common";
import * as http from "http";
import type { AddressInfo } from "net";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../support/app";
import { accessToken, bearer } from "../support/tokens";

const CONSOLE = "https://control.test/harpocrates/ca";
const SERVICE = `${CONSOLE}/api`;

/** What the stub Olympus API was asked, and what it answers. */
type Olympus = {
  url: string;
  requests: { method: string; path: string; body: string }[];
  /** The tokens the token endpoint hands out next. */
  issue: { accessToken: string; refreshToken: string };
  /** The token endpoint refuses refreshes, as for an ended session. */
  refuseRefresh: boolean;
  close: () => Promise<void>;
};

/** The Olympus API, as far as the console's sign-in asks it anything. */
const startOlympus = async (): Promise<Olympus> => {
  const olympus = {
    requests: [],
    issue: { accessToken: "", refreshToken: "refresh-2" },
    refuseRefresh: false,
  } as unknown as Olympus;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      olympus.requests.push({
        method: req.method ?? "",
        path: req.url ?? "",
        body,
      });
      const json = (status: number, answer: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(answer));
      };
      if (req.url === "/v1/auth/token") {
        const form = new URLSearchParams(body);
        if (
          form.get("grant_type") === "refresh_token" &&
          olympus.refuseRefresh
        ) {
          json(400, { error: "invalid_grant" });
          return;
        }
        json(200, {
          access_token: olympus.issue.accessToken,
          token_type: "Bearer",
          expires_in: 600,
          refresh_token: olympus.issue.refreshToken,
        });
      } else if (req.url === "/v1/auth/me") {
        json(200, { user: { email: "neil@example.test" } });
      } else if (req.url === "/v1/auth/logout") {
        json(200, {});
      } else {
        json(404, {});
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  olympus.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  olympus.close = () =>
    new Promise<void>((resolve) => server.close(() => resolve()));
  return olympus;
};

/** The `name=value` pairs a response sets, by name. */
const setCookies = (response: request.Response): Record<string, string> => {
  const header = response.headers["set-cookie"] as unknown as
    string[] | undefined;
  return Object.fromEntries(
    (header ?? []).map((cookie) => {
      const [pair] = cookie.split(";");
      const at = pair.indexOf("=");
      return [pair.slice(0, at), decodeURIComponent(pair.slice(at + 1))];
    }),
  );
};

const CONSOLE_ENV = [
  "OLYMPUS_API_URL",
  "OLYMPUS_SIGN_IN_URL",
  "AUTH_BASE_URL",
  "WEB_APP_URL",
] as const;

describe("the CA console's sign-in (ADR 0029, 0032)", () => {
  describe("without OLYMPUS_API_URL", () => {
    let app: INestApplication;

    beforeEach(async () => {
      app = await createApp();
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it("has no sign-in to start, and takes no cookies", async () => {
      await request(app.getHttpServer()).get("/auth/login/google").expect(503);
      const token = await accessToken({ roles: ["pki-admin"] });
      await request(app.getHttpServer())
        .get("/v1/auth/current-user")
        .set("Cookie", `harpocrates_access_token=${token}`)
        .expect(401);
    });
  });

  describe("with it", () => {
    let app: INestApplication;
    let olympus: Olympus;
    const server = () => request(app.getHttpServer());

    beforeEach(async () => {
      olympus = await startOlympus();
      process.env.OLYMPUS_API_URL = olympus.url;
      process.env.OLYMPUS_SIGN_IN_URL = "https://olympus.test/api";
      process.env.AUTH_BASE_URL = SERVICE;
      process.env.WEB_APP_URL = CONSOLE;
      app = await createApp();
      await app.init();
    });

    afterEach(async () => {
      await app.close();
      await olympus.close();
      for (const name of CONSOLE_ENV) delete process.env[name];
    });

    it("signs in through Olympus and back into the console", async () => {
      const login = await server()
        .get("/auth/login/google")
        .query({ returnTo: `${CONSOLE}/roots` })
        .expect(302);
      const authorize = new URL(login.headers.location as string);
      expect(authorize.origin + authorize.pathname).toBe(
        "https://olympus.test/api/v1/auth/authorize",
      );
      expect(authorize.searchParams.get("client_id")).toBe(
        "harpocrates-ca-console",
      );
      expect(authorize.searchParams.get("redirect_uri")).toBe(
        `${SERVICE}/auth/callback`,
      );
      const transaction = setCookies(login).harpocrates_sign_in_txn;
      expect(transaction).toBeDefined();

      olympus.issue.accessToken = await accessToken({
        roles: ["pki-operator"],
      });
      const callback = await server()
        .get("/auth/callback")
        .query({ code: "a-code", state: authorize.searchParams.get("state") })
        .set(
          "Cookie",
          `harpocrates_sign_in_txn=${encodeURIComponent(transaction)}`,
        )
        .expect(302);
      expect(callback.headers.location).toBe(`${CONSOLE}/roots`);
      const cookies = setCookies(callback);
      expect(cookies.harpocrates_access_token).toBe(olympus.issue.accessToken);
      expect(cookies.harpocrates_refresh_token).toBe("refresh-2");
      const exchange = new URLSearchParams(olympus.requests[0].body);
      expect(exchange.get("grant_type")).toBe("authorization_code");
      expect(exchange.get("device_name")).toBe("Harpocrates CA console");

      const me = await server()
        .get("/v1/auth/current-user")
        .set(
          "Cookie",
          `harpocrates_access_token=${cookies.harpocrates_access_token}`,
        )
        .expect(200);
      expect(me.body).toEqual({
        user: { email: "neil@example.test", roles: ["pki-operator"] },
      });
    });

    it("refuses a callback whose state is not the sign-in's", async () => {
      const login = await server().get("/auth/login/google").expect(302);
      await server()
        .get("/auth/callback")
        .query({ code: "a-code", state: "another" })
        .set(
          "Cookie",
          `harpocrates_sign_in_txn=${encodeURIComponent(setCookies(login).harpocrates_sign_in_txn)}`,
        )
        .expect(400);
    });

    it("describes anyone signed in, whatever their roles", async () => {
      const me = await server()
        .get("/v1/auth/current-user")
        .set("Authorization", await bearer(["content"]))
        .expect(200);
      expect(me.body.user.roles).toEqual([]);
      // ...but nothing else is theirs.
      await server()
        .get("/v1/issuers")
        .set("Authorization", await bearer(["content"]))
        .expect(403);
    });

    it("refreshes an access token that is no good", async () => {
      olympus.issue.accessToken = await accessToken({ roles: ["pki-admin"] });
      const me = await server()
        .get("/v1/auth/current-user")
        .set(
          "Cookie",
          "harpocrates_access_token=expired; harpocrates_refresh_token=refresh-1",
        )
        .expect(200);
      expect(me.body.user.roles).toEqual(["pki-admin"]);
      expect(setCookies(me).harpocrates_refresh_token).toBe("refresh-2");
      const refresh = new URLSearchParams(olympus.requests[0].body);
      expect(refresh.get("refresh_token")).toBe("refresh-1");
    });

    it("clears the cookies of a session Olympus has ended", async () => {
      olympus.refuseRefresh = true;
      const me = await server()
        .get("/v1/auth/current-user")
        .set(
          "Cookie",
          "harpocrates_access_token=expired; harpocrates_refresh_token=refresh-1",
        )
        .expect(401);
      expect(setCookies(me)).toMatchObject({
        harpocrates_access_token: "",
        harpocrates_refresh_token: "",
      });
    });

    it("refuses a change riding on the cookies from another page", async () => {
      const token = await accessToken({ roles: ["pki-admin"] });
      const response = await server()
        .post("/v1/signer/seal")
        .set("Cookie", `harpocrates_access_token=${token}`)
        .set("Origin", "https://elsewhere.test")
        .expect(403);
      expect(response.body.message).toMatch(/come from the console/);
    });

    it("signs out: ends the Olympus session and clears the cookies", async () => {
      const token = await accessToken({ roles: ["pki-admin"] });
      await server()
        .post("/v1/auth/logout")
        .set("Cookie", `harpocrates_access_token=${token}`)
        .set("Origin", "https://elsewhere.test")
        .expect(403);

      const logout = await server()
        .post("/v1/auth/logout")
        .set("Cookie", `harpocrates_access_token=${token}`)
        .set("Origin", "https://control.test")
        .expect(204);
      expect(setCookies(logout)).toMatchObject({
        harpocrates_access_token: "",
        harpocrates_refresh_token: "",
      });
      expect(olympus.requests.map((r) => r.path)).toEqual(["/v1/auth/logout"]);
    });
  });
});
