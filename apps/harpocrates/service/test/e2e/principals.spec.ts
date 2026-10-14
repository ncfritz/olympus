import * as http from "http";
import type { AddressInfo } from "net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accessToken, bearer } from "../support/tokens";
import { E2E_DATABASE_URL, startHarness, type Harness } from "../support/e2e";

/**
 * Who `user:<id>` is (GET /v1/principals): an access token names its user
 * by ID alone, so the audit log records the ID; the console asking who is
 * signed in remembers their email from the Olympus API.
 */
describe.skipIf(!E2E_DATABASE_URL)("principals", () => {
  let harness: Harness;
  let olympus: http.Server;
  let email = "neil@example.test";
  const server = () => harness.app.getHttpServer();

  beforeAll(async () => {
    // The Olympus API, as far as describing the signed-in user.
    olympus = http.createServer((req, res) => {
      res.writeHead(req.url === "/v1/auth/me" ? 200 : 404, {
        "content-type": "application/json",
      });
      res.end(JSON.stringify({ user: { email } }));
    });
    await new Promise<void>((resolve) => olympus.listen(0, resolve));
    const url = `http://127.0.0.1:${(olympus.address() as AddressInfo).port}`;
    harness = await startHarness({
      env: {
        OLYMPUS_API_URL: url,
        OLYMPUS_SIGN_IN_URL: "https://olympus.test/api",
        AUTH_BASE_URL: "https://control.test/harpocrates/ca/api",
        WEB_APP_URL: "https://control.test/harpocrates/ca",
      },
    });
  });

  afterAll(async () => {
    await harness?.close();
    await new Promise((resolve) => olympus?.close(resolve));
  });

  const principals = async () =>
    (
      (
        await request(server())
          .get("/v1/principals")
          .set("Authorization", harness.operator)
          .expect(200)
      ).body as { principals: { principal: string; email: string }[] }
    ).principals;

  it("knows nobody until they are described", async () => {
    expect(
      (await principals()).find((p) => p.principal === "user:person-2"),
    ).toBeUndefined();
  });

  it("remembers a user's email when the console asks who is signed in", async () => {
    const token = `Bearer ${await accessToken({ roles: ["pki-admin"], sub: "person-2" })}`;
    await request(server())
      .get("/v1/auth/current-user")
      .set("Authorization", token)
      .expect(200);
    expect(await principals()).toContainEqual(
      expect.objectContaining({
        principal: "user:person-2",
        email: "neil@example.test",
      }),
    );
  });

  it("says when the user signed in, and until when that is recent enough", async () => {
    const answer = await request(server())
      .get("/v1/auth/current-user")
      .set(
        "Authorization",
        `Bearer ${await accessToken({ roles: ["pki-admin"], sub: "person-2", signedInAgo: 100 })}`,
      )
      .expect(200);
    const { signedInAt, recentUntil } = answer.body.user as {
      signedInAt: string;
      recentUntil: string;
    };
    const ago = (Date.now() - Date.parse(signedInAt)) / 1000;
    expect(ago).toBeGreaterThanOrEqual(99);
    expect(ago).toBeLessThan(110);
    // AUTH_RECENT_SIGN_IN_SECONDS, at its default.
    expect((Date.parse(recentUntil) - Date.parse(signedInAt)) / 1000).toBe(300);
  });

  it("keeps the email the Olympus API last gave", async () => {
    email = "neil@ncfritz.net";
    await request(server())
      .get("/v1/auth/current-user")
      .set(
        "Authorization",
        `Bearer ${await accessToken({ roles: ["pki-admin"], sub: "person-2" })}`,
      )
      .expect(200);
    expect(
      (await principals()).filter((p) => p.principal === "user:person-2"),
    ).toEqual([expect.objectContaining({ email: "neil@ncfritz.net" })]);
  });

  it("needs a PKI role", async () => {
    await request(server())
      .get("/v1/principals")
      .set("Authorization", await bearer(["content"]))
      .expect(403);
  });
});
