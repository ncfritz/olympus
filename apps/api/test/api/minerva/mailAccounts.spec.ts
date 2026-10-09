import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import type { Server } from "https";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as jose from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServicesListener } from "../../../src/auth/servicesListener";
import { issueAccessToken } from "../../../src/auth/tokens/accessTokens";
import { SigningKeyService } from "../../../src/auth/tokens/SigningKeyService";
import { devCa, identity, servicesConfig } from "../../support/devCa";
import { createTestApp, type TestApp } from "../../support/testApp";

const IMPORT = "/v1/minerva/mail/accounts/import";
const OWNER_ID = "5f1a0c6e-0000-4000-8000-000000000001";
const OTHER_ID = "5f1a0c6e-0000-4000-8000-0000000000ff";
const ACCOUNT_ID = "7b2b0000-0000-4000-8000-000000000001";

const account = (userId = OWNER_ID) => ({
  id: ACCOUNT_ID,
  userId,
  email: "owner@example.test",
  verificationMethod: "import",
  verifiedTime: "2026-10-05T23:00:00.000Z",
});

/**
 * ImportMailAccount: the mail agent's Takeout import (ADR 0030), over the
 * services listener as an agent, both listeners enforcing.
 */
describe("ImportMailAccount", () => {
  let t: TestApp;
  let server: Server;
  let port: number;
  let existing: ReturnType<typeof account> | undefined;

  const asAgent = (body: unknown, name = "agents/dionysus-search-agent") =>
    new Promise<{ status?: number; body: string }>((resolve, reject) => {
      const payload = JSON.stringify(body);
      const request = https.request(
        {
          host: "127.0.0.1",
          port,
          path: IMPORT,
          method: "POST",
          servername: "localhost",
          ca: fs.readFileSync(path.join(devCa(), "services-ca.crt")),
          ...identity(name),
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
          },
        },
        (response) => {
          let text = "";
          response.on("data", (chunk) => (text += chunk));
          response.on("end", () =>
            resolve({ status: response.statusCode, body: text }),
          );
        },
      );
      request.on("error", reject);
      request.end(payload);
    });

  beforeAll(async () => {
    const keys = mkdtempSync(path.join(tmpdir(), "auth-keys-"));
    const { privateKey } = await jose.generateKeyPair("ES256", {
      extractable: true,
    });
    writeFileSync(
      path.join(keys, "2026-01-01.pem"),
      await jose.exportPKCS8(privateKey),
    );
    t = await createTestApp({
      env: {
        AUTH_SIGNING_KEYS: keys,
        AUTH_MODE_USERS: "enforce",
        AUTH_MODE_SERVICES: "enforce",
        // One agent with the role, one without.
        AUTH_SERVICE_ROLES:
          "dionysus-search-agent:agent,dionysus-asset-agent:content",
      },
    });
    server = createServicesListener(t.app, servicesConfig());
    await new Promise((resolve) => server.once("listening", resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    server.close();
    await t.close();
  });

  beforeEach(() => {
    t.reset();
    existing = undefined;
    t.graphql.on("DescribeMailAccountOwner", (vars) => ({
      olympus_users:
        (vars as { email: string }).email === "neil@example.test"
          ? [{ id: OWNER_ID }]
          : [],
    }));
    t.graphql.on("DescribeMailAccountByEmail", () => ({
      minerva_mail_accounts: existing ? [existing] : [],
    }));
    t.graphql.on("ImportMailAccount", () => ({
      insert_minerva_mail_accounts_one: account(),
    }));
  });

  it("makes a new mailbox the named user's, by import", async () => {
    const res = await asAgent({
      email: " Owner@Example.test ",
      ownerEmail: "Neil@Example.test",
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      mailAccount: {
        id: ACCOUNT_ID,
        email: "owner@example.test",
        verification: "import",
        verifiedTime: "2026-10-05T23:00:00.000Z",
      },
    });
    expect(t.graphql.calls("DescribeMailAccountOwner")[0].variables).toEqual({
      email: "neil@example.test",
    });
    expect(t.graphql.calls("ImportMailAccount")[0].variables).toMatchObject({
      account: {
        userId: OWNER_ID,
        email: "owner@example.test",
        verificationMethod: "import",
      },
    });
  });

  it("answers the same account when the same user imports it again", async () => {
    existing = account();
    const res = await asAgent({
      email: "owner@example.test",
      ownerEmail: "neil@example.test",
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).mailAccount.id).toBe(ACCOUNT_ID);
    expect(t.graphql.calls("ImportMailAccount")).toHaveLength(0);
  });

  it("answers 409 when the mailbox is another user's", async () => {
    existing = account(OTHER_ID);
    const res = await asAgent({
      email: "owner@example.test",
      ownerEmail: "neil@example.test",
    });
    expect(res.status).toBe(409);
    expect(t.graphql.calls("ImportMailAccount")).toHaveLength(0);
  });

  it("answers 404 when no user has the owner's email", async () => {
    const res = await asAgent({
      email: "owner@example.test",
      ownerEmail: "nobody@example.test",
    });
    expect(res.status).toBe(404);
    expect(t.graphql.calls("ImportMailAccount")).toHaveLength(0);
  });

  it.each([
    ["no email", { ownerEmail: "neil@example.test" }],
    [
      "an email that is not one",
      { email: "owner", ownerEmail: "neil@example.test" },
    ],
    ["no owner", { email: "owner@example.test" }],
    [
      "an owner that is not text",
      { email: "owner@example.test", ownerEmail: 7 },
    ],
  ])("answers 400 to %s, before Hasura", async (_case, body) => {
    const res = await asAgent(body);
    expect(res.status).toBe(400);
    expect(t.graphql.calls("DescribeMailAccountOwner")).toHaveLength(0);
  });

  it("answers 403 to a service without the agent role", async () => {
    const res = await asAgent(
      { email: "owner@example.test", ownerEmail: "neil@example.test" },
      "agents/dionysus-asset-agent",
    );
    expect(res.status).toBe(403);
  });

  it("answers 403 to a signed-in user, even an admin", async () => {
    const token = await issueAccessToken(
      t.app.get(SigningKeyService).require(),
      {
        sub: OWNER_ID,
        clientId: "olympus-site",
        sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
        roles: ["user", "admin"],
        authTime: 1_790_000_000,
      },
    );
    const res = await t
      .http()
      .post(IMPORT)
      .set("authorization", `Bearer ${token}`)
      .send({ email: "owner@example.test", ownerEmail: "neil@example.test" });
    expect(res.status).toBe(403);
  });

  it("answers 401 without any identity", async () => {
    const res = await t
      .http()
      .post(IMPORT)
      .send({ email: "owner@example.test", ownerEmail: "neil@example.test" });
    expect(res.status).toBe(401);
  });
});
