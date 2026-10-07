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

const ACCOUNT_ID = "7b2b0000-0000-4000-8000-000000000001";
const USER_ID = "5f1a0c6e-0000-4000-8000-000000000001";
const BASE = "/v1/minerva/mail";
const EXAMPLES = `${BASE}/training/payment-examples?accountId=${ACCOUNT_ID}`;
const SCORES = `${BASE}/account/${ACCOUNT_ID}/payment-scores`;

/**
 * Learned payments (docs/plans/email-management phase 7 step 3): what the
 * classifier learns from, and its scores; agents only.
 */
describe("Mail payment learning", () => {
  let t: TestApp;
  let server: Server;
  let port: number;

  const asAgent = (
    method: string,
    url: string,
    body?: unknown,
    name = "agents/minerva-mail-ml",
  ) =>
    new Promise<{ status?: number; body: string }>((resolve, reject) => {
      const payload = body === undefined ? "" : JSON.stringify(body);
      const request = https.request(
        {
          host: "127.0.0.1",
          port,
          path: url,
          method,
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
        AUTH_SERVICE_ROLES:
          "minerva-mail-ml:agent,dionysus-asset-agent:content",
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

  beforeEach(() => t.reset());

  describe("ListMailPaymentExamples", () => {
    it("gives payments approved, and declined ones and bills as not", async () => {
      t.graphql.on("ListMailPaymentExamples", {
        accepted: [{ confirmation: { gmailId: "d1" } }],
        declined: [
          { confirmation: { gmailId: "d2" } },
          { confirmation: { gmailId: "d1" } },
        ],
        bills: [{ gmailId: "b1" }, { gmailId: "d2" }],
      });
      const res = await asAgent("GET", EXAMPLES);
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).examples).toEqual([
        { gmailId: "d1", payment: true },
        { gmailId: "b1", payment: false },
        { gmailId: "d2", payment: false },
      ]);
    });
  });

  describe("RecordMailPaymentScores", () => {
    beforeEach(() => {
      t.graphql.on("DescribeMailPaymentScoreTargets", {
        minerva_mail_accounts_by_pk: {
          id: ACCOUNT_ID,
          messages: [{ gmailId: "d1" }, { gmailId: "d3" }],
        },
      });
      t.graphql.on("ReplaceMailPaymentScores", {
        delete_minerva_mail_payment_scores: { affected_rows: 4 },
        insert_minerva_mail_payment_scores: { affected_rows: 2 },
      });
      t.graphql.on("RecordMailPaymentScores", {
        insert_minerva_mail_payment_scores: { affected_rows: 1 },
      });
    });

    it("replaces the account's scores with a run's first batch", async () => {
      const res = await asAgent("PUT", SCORES, {
        first: true,
        scores: [
          { gmailId: "d1", score: 0.93456 },
          { gmailId: "d3", score: 0.81 },
          { gmailId: "ff", score: 0.99 },
        ],
      });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ recorded: 2, skipped: 1 });
      const vars = t.graphql.calls("ReplaceMailPaymentScores")[0].variables as {
        accountId: string;
        rows: { score: number }[];
      };
      expect(vars.accountId).toBe(ACCOUNT_ID);
      expect(vars.rows.map((r) => r.score)).toEqual([0.935, 0.81]);
      expect(t.graphql.calls("RecordMailPaymentScores")).toHaveLength(0);
    });

    it("adds a later batch's", async () => {
      const res = await asAgent("PUT", SCORES, {
        first: false,
        scores: [{ gmailId: "d1", score: 0.9 }],
      });
      expect(res.status).toBe(200);
      expect(t.graphql.calls("ReplaceMailPaymentScores")).toHaveLength(0);
      expect(t.graphql.calls("RecordMailPaymentScores")).toHaveLength(1);
    });

    it.each([
      ["no first", { scores: [] }],
      [
        "a score past 1",
        { first: true, scores: [{ gmailId: "d1", score: 1.2 }] },
      ],
      [
        "an ID that is not Gmail's",
        { first: true, scores: [{ gmailId: "X", score: 0.5 }] },
      ],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await asAgent("PUT", SCORES, body);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeMailPaymentScoreTargets")).toHaveLength(
        0,
      );
    });
  });

  it.each([
    ["GET", EXAMPLES],
    ["PUT", SCORES],
  ])(
    "answers 403 on %s %s to a service without the agent role",
    async (method, url) => {
      const res = await asAgent(
        method,
        url,
        method === "GET" ? undefined : {},
        "agents/dionysus-asset-agent",
      );
      expect(res.status).toBe(403);
    },
  );

  it("answers 403 to a signed-in user, even an admin", async () => {
    const token = await issueAccessToken(
      t.app.get(SigningKeyService).require(),
      {
        sub: USER_ID,
        clientId: "olympus-site",
        sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
        roles: ["user", "admin"],
        authTime: 1_790_000_000,
      },
    );
    const res = await t
      .http()
      .put(SCORES)
      .set("authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });
});
