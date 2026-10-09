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
const RUN_ID = "5a660000-0000-4000-8000-0000000002a1";
const USER_ID = "5f1a0c6e-0000-4000-8000-000000000001";
const BILLS = "c1000000-0000-4000-8000-000000000001";
const TRAVEL = "c1000000-0000-4000-8000-000000000002";
const M1 = "a1000000-0000-4000-8000-000000000001";
const M2 = "a1000000-0000-4000-8000-000000000002";

const RUNS = "/v1/minerva/mail/suggestion-runs";
const SUGGESTIONS = `/v1/minerva/mail/suggestion-run/${RUN_ID}/suggestions`;
const PUBLISH = `/v1/minerva/mail/suggestion-run/${RUN_ID}/publish`;
const SCORED = `/v1/minerva/mail/account/${ACCOUNT_ID}/message-suggestions`;

const run = (overrides: Record<string, unknown> = {}) => ({
  id: RUN_ID,
  accountId: ACCOUNT_ID,
  modelRun: "6ca3f45f",
  featureVersion: "v1",
  status: "building",
  startedTime: "2026-10-06T08:00:00+00:00",
  finishedTime: null,
  messagesScored: null,
  ...overrides,
});

const suggestion = (overrides: Record<string, unknown> = {}) => ({
  gmailId: "19be00000000a1",
  label: "Bills",
  action: "add",
  confidence: 0.9714,
  ticked: true,
  ...overrides,
});

/**
 * The classifier's suggestions over the mailbox (docs/plans/
 * email-management phase 4): agents only, over the services listener.
 */
describe("Mail suggestions", () => {
  let t: TestApp;
  let server: Server;
  let port: number;
  let current: ReturnType<typeof run> | null;

  const asAgent = (
    url: string,
    body: unknown,
    name = "agents/minerva-mail-ml",
    method = "POST",
  ) =>
    new Promise<{ status?: number; body: string }>((resolve, reject) => {
      const payload = JSON.stringify(body);
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
          "minerva-mail-ml:agent,minerva-mail-agent:agent,dionysus-asset-agent:content",
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
    current = run();
    t.graphql.on("DescribeMailSuggestionAccount", (vars) => ({
      minerva_mail_accounts_by_pk:
        (vars as { accountId: string }).accountId === ACCOUNT_ID
          ? { id: ACCOUNT_ID }
          : null,
    }));
    t.graphql.on("DescribeMailSuggestionRun", () => ({
      minerva_mail_suggestion_runs_by_pk: current,
    }));
    t.graphql.on("CreateMailSuggestionRun", {
      insert_minerva_mail_suggestion_runs_one: run(),
    });
    t.graphql.on("DescribeMailSuggestionTargets", {
      minerva_mail_messages: [
        // M1 has Bills; M2 has nothing yet.
        {
          id: M1,
          gmailId: "19be00000000a1",
          messageLabels: [{ labelId: BILLS }],
        },
        { id: M2, gmailId: "19be00000000a2", messageLabels: [] },
      ],
      minerva_mail_labels: [
        { id: BILLS, name: "Bills" },
        { id: TRAVEL, name: "Travel" },
      ],
    });
    t.graphql.on("CreateMailSuggestions", {
      insert_minerva_mail_suggestions: { affected_rows: 1 },
    });
    t.graphql.on("DescribeMailMessageSuggestionLabels", {
      minerva_mail_labels: [
        { id: BILLS, name: "Bills" },
        { id: TRAVEL, name: "Travel" },
      ],
    });
    t.graphql.on("RecordMailMessageSuggestions", {
      insert_minerva_mail_message_scores: { affected_rows: 2 },
      delete_minerva_mail_message_suggestions: { affected_rows: 0 },
      insert_minerva_mail_message_suggestions: { affected_rows: 2 },
    });
    t.graphql.on("PublishMailSuggestionRun", {
      update_minerva_mail_suggestion_runs_by_pk: run({
        status: "ready",
        finishedTime: "2026-10-06T08:10:00+00:00",
        messagesScored: 255056,
      }),
      delete_minerva_mail_suggestion_runs: { affected_rows: 1 },
    });
  });

  describe("CreateMailSuggestionRun", () => {
    it("begins a building run for the account", async () => {
      const res = await asAgent(RUNS, {
        accountId: ACCOUNT_ID,
        modelRun: "6ca3f45f",
        featureVersion: "v1",
      });
      expect(res.status).toBe(201);
      expect(JSON.parse(res.body).run).toMatchObject({
        id: RUN_ID,
        status: "building",
        modelRun: "6ca3f45f",
      });
      expect(t.graphql.calls("CreateMailSuggestionRun")[0].variables).toEqual({
        run: {
          accountId: ACCOUNT_ID,
          modelRun: "6ca3f45f",
          featureVersion: "v1",
        },
      });
    });

    it("answers 404 for an account that does not exist", async () => {
      const res = await asAgent(RUNS, {
        accountId: "7b2b0000-0000-4000-8000-0000000000ff",
        modelRun: "6ca3f45f",
        featureVersion: "v1",
      });
      expect(res.status).toBe(404);
      expect(t.graphql.calls("CreateMailSuggestionRun")).toHaveLength(0);
    });

    it.each([
      ["no accountId", { modelRun: "r", featureVersion: "v1" }],
      [
        "an accountId that is not one",
        { accountId: "7b2b", modelRun: "r", featureVersion: "v1" },
      ],
      ["no modelRun", { accountId: ACCOUNT_ID, featureVersion: "v1" }],
      [
        "a modelRun past 100",
        {
          accountId: ACCOUNT_ID,
          modelRun: "r".repeat(101),
          featureVersion: "v1",
        },
      ],
      ["no featureVersion", { accountId: ACCOUNT_ID, modelRun: "r" }],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await asAgent(RUNS, body);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeMailSuggestionAccount")).toHaveLength(0);
    });
  });

  describe("CreateMailSuggestions", () => {
    it("stores what fits the mailbox and counts what does not", async () => {
      const res = await asAgent(SUGGESTIONS, {
        suggestions: [
          suggestion({ gmailId: "19be00000000a2" }), // add Bills to M2: kept
          suggestion(), // add Bills to M1, which has it: skipped
          suggestion({ action: "remove", confidence: 0.62, ticked: false }), // remove Bills from M1: kept
          suggestion({
            gmailId: "19be00000000a2",
            label: "Travel",
            action: "remove",
          }), // M2 lacks Travel: skipped
          suggestion({ gmailId: "19be0000000000ff" }), // no such message
          suggestion({ label: "Gone" }), // no such label (or not the user's)
        ],
      });
      expect(res.status).toBe(201);
      expect(JSON.parse(res.body)).toEqual({ created: 2, skipped: 4 });
      expect(
        t.graphql.calls("DescribeMailSuggestionTargets")[0].variables,
      ).toEqual({
        accountId: ACCOUNT_ID,
        gmailIds: ["19be00000000a2", "19be00000000a1", "19be0000000000ff"],
        names: ["Bills", "Travel", "Gone"],
      });
      expect(t.graphql.calls("CreateMailSuggestions")[0].variables).toEqual({
        suggestions: [
          {
            runId: RUN_ID,
            messageId: M2,
            labelId: BILLS,
            action: "add",
            confidence: 0.971,
            ticked: true,
          },
          {
            runId: RUN_ID,
            messageId: M1,
            labelId: BILLS,
            action: "remove",
            confidence: 0.62,
            ticked: false,
          },
        ],
      });
    });

    it("writes nothing when nothing fits", async () => {
      const res = await asAgent(SUGGESTIONS, {
        suggestions: [suggestion()],
      });
      expect(JSON.parse(res.body)).toEqual({ created: 0, skipped: 1 });
      expect(t.graphql.calls("CreateMailSuggestions")).toHaveLength(0);
    });

    it("answers 409 for a published run", async () => {
      current = run({ status: "ready" });
      const res = await asAgent(SUGGESTIONS, { suggestions: [suggestion()] });
      expect(res.status).toBe(409);
      expect(t.graphql.calls("DescribeMailSuggestionTargets")).toHaveLength(0);
    });

    it("answers 404 for a run that does not exist", async () => {
      current = null;
      const res = await asAgent(SUGGESTIONS, { suggestions: [suggestion()] });
      expect(res.status).toBe(404);
    });

    it.each([
      ["no suggestions", {}],
      ["an empty batch", { suggestions: [] }],
      [
        "a batch past 5000",
        { suggestions: Array.from({ length: 5001 }, () => suggestion()) },
      ],
      [
        "a gmailId that is not one",
        { suggestions: [suggestion({ gmailId: "zz" })] },
      ],
      ["an empty label", { suggestions: [suggestion({ label: "" })] }],
      ["an unknown action", { suggestions: [suggestion({ action: "move" })] }],
      [
        "a confidence above 1",
        { suggestions: [suggestion({ confidence: 1.2 })] },
      ],
      [
        "a confidence that is not a number",
        { suggestions: [suggestion({ confidence: "high" })] },
      ],
      ["no ticked", { suggestions: [suggestion({ ticked: undefined })] }],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await asAgent(SUGGESTIONS, body);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeMailSuggestionRun")).toHaveLength(0);
    });

    it("answers 400 to a run ID that is not one", async () => {
      const res = await asAgent(
        "/v1/minerva/mail/suggestion-run/5a66/suggestions",
        { suggestions: [suggestion()] },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("PublishMailSuggestionRun", () => {
    it("publishes the run and drops the account's runs before it", async () => {
      const res = await asAgent(PUBLISH, { messagesScored: 255056 });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).run).toMatchObject({
        status: "ready",
        messagesScored: 255056,
        finishedTime: "2026-10-06T08:10:00.000Z",
      });
      expect(
        t.graphql.calls("PublishMailSuggestionRun")[0].variables,
      ).toMatchObject({ runId: RUN_ID, accountId: ACCOUNT_ID, scored: 255056 });
    });

    it("answers 409 for a run published already", async () => {
      current = run({ status: "ready" });
      const res = await asAgent(PUBLISH, { messagesScored: 1 });
      expect(res.status).toBe(409);
      expect(t.graphql.calls("PublishMailSuggestionRun")).toHaveLength(0);
    });

    it.each([
      ["no count", {}],
      ["a negative count", { messagesScored: -1 }],
      ["a fractional count", { messagesScored: 1.5 }],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await asAgent(PUBLISH, body);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeMailSuggestionRun")).toHaveLength(0);
    });
  });

  describe("RecordMailMessageSuggestions", () => {
    const record = (body: unknown) =>
      asAgent(SCORED, body, "agents/minerva-mail-agent", "PUT");

    it("replaces each message's suggestions, best first, by label name", async () => {
      const res = await record({
        modelRun: "6ca3f45f",
        featureVersion: "v1",
        messages: [
          {
            gmailId: "19be00000000b1",
            suggestions: [
              { label: "Travel", score: 0.96249, ticked: true },
              { label: "Gone/Label", score: 0.4, ticked: false },
              { label: "Bills", score: 0.2, ticked: false },
              { label: "Travel", score: 0.1, ticked: false },
            ],
          },
          // Scored, nothing reached the floor.
          { gmailId: "19be00000000b2", suggestions: [] },
        ],
      });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        messages: 2,
        suggestions: 2,
        skipped: 1,
      });
      const vars = t.graphql.calls("RecordMailMessageSuggestions")[0]
        .variables as Record<string, unknown>;
      expect(vars.gmailIds).toEqual(["19be00000000b1", "19be00000000b2"]);
      expect(vars.scores).toEqual([
        expect.objectContaining({
          accountId: ACCOUNT_ID,
          gmailId: "19be00000000b1",
          modelRun: "6ca3f45f",
          featureVersion: "v1",
        }),
        expect.objectContaining({ gmailId: "19be00000000b2" }),
      ]);
      expect(vars.suggestions).toEqual([
        {
          accountId: ACCOUNT_ID,
          gmailId: "19be00000000b1",
          labelId: TRAVEL,
          rank: 0,
          score: 0.962,
          ticked: true,
        },
        {
          accountId: ACCOUNT_ID,
          gmailId: "19be00000000b1",
          labelId: BILLS,
          rank: 1,
          score: 0.2,
          ticked: false,
        },
      ]);
    });

    it("answers 404 for an account that does not exist", async () => {
      const res = await asAgent(
        "/v1/minerva/mail/account/7b2b0000-0000-4000-8000-0000000000ff/message-suggestions",
        {
          modelRun: "r",
          featureVersion: "v1",
          messages: [{ gmailId: "19be00000000b1", suggestions: [] }],
        },
        "agents/minerva-mail-agent",
        "PUT",
      );
      expect(res.status).toBe(404);
      expect(t.graphql.calls("RecordMailMessageSuggestions")).toHaveLength(0);
    });

    const ok = { gmailId: "19be00000000b1", suggestions: [] };
    it.each([
      ["no modelRun", { featureVersion: "v1", messages: [ok] }],
      ["no messages", { modelRun: "r", featureVersion: "v1", messages: [] }],
      [
        "more than 500 messages",
        {
          modelRun: "r",
          featureVersion: "v1",
          messages: Array.from({ length: 501 }, () => ok),
        },
      ],
      [
        "a Gmail ID that is not one",
        {
          modelRun: "r",
          featureVersion: "v1",
          messages: [{ gmailId: "xyz", suggestions: [] }],
        },
      ],
      [
        "a score past 1",
        {
          modelRun: "r",
          featureVersion: "v1",
          messages: [
            {
              gmailId: "19be00000000b1",
              suggestions: [{ label: "Bills", score: 1.2, ticked: true }],
            },
          ],
        },
      ],
      [
        "more than 20 labels",
        {
          modelRun: "r",
          featureVersion: "v1",
          messages: [
            {
              gmailId: "19be00000000b1",
              suggestions: Array.from({ length: 21 }, (_, i) => ({
                label: `L${i}`,
                score: 0.5,
                ticked: false,
              })),
            },
          ],
        },
      ],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await record(body);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeMailSuggestionAccount")).toHaveLength(0);
    });

    it("answers 403 to a service without the agent role", async () => {
      const res = await asAgent(
        SCORED,
        {},
        "agents/dionysus-asset-agent",
        "PUT",
      );
      expect(res.status).toBe(403);
    });
  });

  it.each([RUNS, SUGGESTIONS, PUBLISH])(
    "answers 403 on %s to a service without the agent role",
    async (url) => {
      const res = await asAgent(url, {}, "agents/dionysus-asset-agent");
      expect(res.status).toBe(403);
    },
  );

  it.each([RUNS, SUGGESTIONS, PUBLISH])(
    "answers 403 on %s to a signed-in user, even an admin",
    async (url) => {
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
        .post(url)
        .set("authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(403);
    },
  );
});
