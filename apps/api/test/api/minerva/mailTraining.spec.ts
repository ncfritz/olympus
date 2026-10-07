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

const BASE = "/v1/minerva/mail/training";
const ACCOUNT_ID = "7b2b0000-0000-4000-8000-000000000001";
const MISSING_ID = "7b2b0000-0000-4000-8000-0000000000ff";
const USER_ID = "5f1a0c6e-0000-4000-8000-000000000001";

const topical = (name: string) => ({ name, kind: "topical" });
const system = (name: string) => ({ name, kind: "system" });
const state = (name: string, family: string) => ({
  name,
  kind: "state",
  family: { name: family },
});
const retired = (name: string, into: object | null) => ({
  name,
  kind: "retired",
  mergeTarget: into,
});

const message = (gmailId: string, labels: object[], extra = {}) => ({
  gmailId,
  threadId: gmailId,
  receivedTime: "2026-01-02T03:04:05+00:00",
  fromAddress: "billing@srp.example",
  listId: null,
  sent: false,
  messageLabels: labels.map((label) => ({ label })),
  ...extra,
});

/**
 * The classifier's training data (ADR 0030, Label kinds): agents only,
 * over the services listener, both listeners enforcing.
 */
describe("Mail training data", () => {
  let t: TestApp;
  let server: Server;
  let port: number;

  const asAgent = (url: string, name = "agents/minerva-mail-ml") =>
    new Promise<{ status?: number; body: string }>((resolve, reject) => {
      const request = https.request(
        {
          host: "127.0.0.1",
          port,
          path: BASE + url,
          method: "GET",
          servername: "localhost",
          ca: fs.readFileSync(path.join(devCa(), "services-ca.crt")),
          ...identity(name),
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
      request.end();
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

  beforeEach(() => {
    t.reset();
    t.graphql.on("DescribeMailTrainingAccount", (vars) => ({
      minerva_mail_accounts_by_pk:
        (vars as { accountId: string }).accountId === ACCOUNT_ID
          ? { id: ACCOUNT_ID }
          : null,
    }));
  });

  describe("ListMailTrainingAccounts", () => {
    it("lists every account", async () => {
      t.graphql.on("ListMailTrainingAccounts", {
        minerva_mail_accounts: [
          { id: ACCOUNT_ID, email: "owner@example.test" },
        ],
      });
      const res = await asAgent("/accounts");
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        accounts: [{ id: ACCOUNT_ID, email: "owner@example.test" }],
      });
    });
  });

  describe("ListMailTrainingExamples", () => {
    it("maps labels to targets by kind", async () => {
      t.graphql.on("ListMailTrainingExamples", {
        minerva_mail_messages: [
          message("19be0000000000a1", [
            topical("Finance/Bank of America"),
            topical("Finance/Bank of America"),
            state("Bills/*Paid", "Bills"),
            system("INBOX"),
            system("STARRED"),
            retired("Old/Bank", topical("Finance")),
            retired("Old/Paid", state("Bills/*Payable", "Bills")),
            retired("Old/Lost", null),
          ]),
          message("19be0000000000a2", [], {
            fromAddress: null,
            listId: "news.example",
            sent: true,
          }),
        ],
      });
      const res = await asAgent(`/examples?accountId=${ACCOUNT_ID}`);
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        examples: [
          {
            gmailId: "19be0000000000a1",
            threadId: "19be0000000000a1",
            receivedTime: "2026-01-02T03:04:05.000Z",
            fromAddress: "billing@srp.example",
            sent: false,
            topics: ["Finance", "Finance/Bank of America"],
            families: ["Bills"],
          },
          {
            gmailId: "19be0000000000a2",
            threadId: "19be0000000000a2",
            receivedTime: "2026-01-02T03:04:05.000Z",
            listId: "news.example",
            sent: true,
            topics: [],
            families: [],
          },
        ],
      });
      expect(t.graphql.calls("ListMailTrainingExamples")[0].variables).toEqual({
        where: { accountId: { _eq: ACCOUNT_ID } },
        limit: 1000,
      });
    });

    it("pages by Gmail ID", async () => {
      t.graphql.on("ListMailTrainingExamples", {
        minerva_mail_messages: [
          message("19be0000000000b1", []),
          message("19be0000000000b2", []),
        ],
      });
      const res = await asAgent(
        `/examples?accountId=${ACCOUNT_ID}&after=19be0000000000a9&limit=2`,
      );
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).nextCursor).toBe("19be0000000000b2");
      expect(t.graphql.calls("ListMailTrainingExamples")[0].variables).toEqual({
        where: {
          accountId: { _eq: ACCOUNT_ID },
          gmailId: { _gt: "19be0000000000a9" },
        },
        limit: 2,
      });
    });

    it("says which were approved in the inbox, and which amended", async () => {
      t.graphql.on("ListMailTrainingExamples", {
        minerva_mail_messages: [
          message("19be0000000000c1", [], {
            inboxDecision: { decision: "approved", amended: false },
          }),
          message("19be0000000000c2", [], {
            inboxDecision: { decision: "approved", amended: true },
          }),
          message("19be0000000000c3", [], {
            inboxDecision: { decision: "skipped", amended: false },
          }),
          message("19be0000000000c4", [], { inboxDecision: null }),
        ],
      });
      const res = await asAgent(`/examples?accountId=${ACCOUNT_ID}`);
      expect(
        JSON.parse(res.body).examples.map(
          (e: { decision?: string }) => e.decision,
        ),
      ).toEqual(["approved", "amended", undefined, undefined]);
    });

    it("has no cursor on the last page", async () => {
      t.graphql.on("ListMailTrainingExamples", {
        minerva_mail_messages: [message("19be0000000000b1", [])],
      });
      const res = await asAgent(`/examples?accountId=${ACCOUNT_ID}&limit=2`);
      expect(JSON.parse(res.body).nextCursor).toBeUndefined();
    });

    it("answers 404 for an account that does not exist", async () => {
      const res = await asAgent(`/examples?accountId=${MISSING_ID}`);
      expect(res.status).toBe(404);
      expect(t.graphql.calls("ListMailTrainingExamples")).toHaveLength(0);
    });

    it.each([
      ["no accountId", ""],
      ["an accountId that is not one", "?accountId=7b2b"],
      ["an after that is not a Gmail ID", `?accountId=${ACCOUNT_ID}&after=zz`],
      ["a limit that is not a number", `?accountId=${ACCOUNT_ID}&limit=lots`],
      ["a limit of 0", `?accountId=${ACCOUNT_ID}&limit=0`],
      ["a limit over 5000", `?accountId=${ACCOUNT_ID}&limit=5001`],
    ])("answers 400 to %s, before Hasura", async (_case, query) => {
      const res = await asAgent(`/examples${query}`);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeMailTrainingAccount")).toHaveLength(0);
    });
  });

  describe("ListMailTrainingDecisions", () => {
    const decision = (
      messageId: string,
      decidedTime: string,
      batch: { status: string } | null,
      amended = false,
    ) => ({
      messageId,
      decidedTime,
      batch,
      message: message("19be0000000000d1", [topical("Travel")], {
        inboxDecision: { decision: "approved", amended },
      }),
    });
    const M1 = "7b2b0000-0000-4000-8000-0000000000e1";
    const M2 = "7b2b0000-0000-4000-8000-0000000000e2";

    it("lists approvals in order, ready once their labels are written", async () => {
      t.graphql.on("ListMailTrainingDecisions", {
        minerva_mail_inbox_decisions: [
          decision(M1, "2026-10-06T08:00:00.123456+00:00", { status: "done" }),
          decision(
            M2,
            "2026-10-06T08:01:00+00:00",
            { status: "running" },
            true,
          ),
        ],
      });

      const res = await asAgent(`/decisions?accountId=${ACCOUNT_ID}&limit=2`);

      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.decisions).toHaveLength(2);
      expect(body.decisions[0]).toMatchObject({
        example: {
          gmailId: "19be0000000000d1",
          topics: ["Travel"],
          decision: "approved",
        },
        decidedTime: "2026-10-06T08:00:00.123Z",
        ready: true,
      });
      expect(body.decisions[1]).toMatchObject({
        example: { decision: "amended" },
        ready: false,
      });
      expect(body.nextCursor).toBe(body.decisions[1].cursor);

      // The next page carries on after the cursor given.
      t.graphql.on("ListMailTrainingDecisions", {
        minerva_mail_inbox_decisions: [
          decision(M2, "2026-10-06T08:01:00+00:00", null),
        ],
      });
      const next = await asAgent(
        `/decisions?accountId=${ACCOUNT_ID}&after=${body.decisions[0].cursor}`,
      );
      expect(JSON.parse(next.body).decisions[0].ready).toBe(true);
      expect(JSON.parse(next.body).nextCursor).toBeUndefined();
      expect(t.graphql.calls("ListMailTrainingDecisions")[1].variables).toEqual(
        {
          where: {
            accountId: { _eq: ACCOUNT_ID },
            decision: { _eq: "approved" },
            _or: [
              { decidedTime: { _gt: "2026-10-06T08:00:00.123456+00:00" } },
              {
                decidedTime: { _eq: "2026-10-06T08:00:00.123456+00:00" },
                messageId: { _gt: M1 },
              },
            ],
          },
          limit: 500,
        },
      );
    });

    it.each([
      ["a cursor that is not one", `?accountId=${ACCOUNT_ID}&after=nonsense`],
      ["a limit over 1000", `?accountId=${ACCOUNT_ID}&limit=1001`],
      ["no accountId", ""],
    ])("answers 400 to %s, before Hasura", async (_case, query) => {
      const res = await asAgent(`/decisions${query}`);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("ListMailTrainingDecisions")).toHaveLength(0);
    });
  });

  describe("ListMailInboxToScore", () => {
    it("lists what is to review in the inbox, newest first", async () => {
      t.graphql.on("ListMailInboxToScore", {
        minerva_mail_inbox: [
          { gmailId: "19be0000000000f2" },
          { gmailId: "19be0000000000f1" },
        ],
      });
      const res = await asAgent(`/inbox?accountId=${ACCOUNT_ID}`);
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        gmailIds: ["19be0000000000f2", "19be0000000000f1"],
      });
      expect(t.graphql.calls("ListMailInboxToScore")[0].variables).toEqual({
        accountId: ACCOUNT_ID,
        limit: 5000,
      });
    });

    it("answers 404 for an account that does not exist", async () => {
      const res = await asAgent(`/inbox?accountId=${MISSING_ID}`);
      expect(res.status).toBe(404);
    });
  });

  describe("ListMailTrainingLabels", () => {
    it("lists topics and families", async () => {
      t.graphql.on("ListMailTrainingLabels", {
        minerva_mail_accounts_by_pk: { id: ACCOUNT_ID },
        minerva_mail_labels: [{ name: "Bills/SRP" }, { name: "Finance" }],
        minerva_mail_label_families: [
          {
            name: "Bills",
            initialLabel: { name: "Bills/*Payable" },
            states: [{ name: "Bills/*Payable" }, { name: "Bills/*Paid" }],
          },
        ],
      });
      const res = await asAgent(`/labels?accountId=${ACCOUNT_ID}`);
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        topics: ["Bills/SRP", "Finance"],
        families: [
          {
            name: "Bills",
            initialLabel: "Bills/*Payable",
            states: ["Bills/*Paid", "Bills/*Payable"],
          },
        ],
      });
      expect(t.graphql.calls("ListMailTrainingLabels")[0].variables).toEqual({
        accountId: ACCOUNT_ID,
        topical: "topical",
      });
    });

    it("answers 404 for an account that does not exist", async () => {
      t.graphql.on("ListMailTrainingLabels", {
        minerva_mail_accounts_by_pk: null,
        minerva_mail_labels: [],
        minerva_mail_label_families: [],
      });
      const res = await asAgent(`/labels?accountId=${MISSING_ID}`);
      expect(res.status).toBe(404);
    });

    it.each([
      ["no accountId", ""],
      ["an accountId that is not one", "?accountId=7b2b"],
    ])("answers 400 to %s, before Hasura", async (_case, query) => {
      const res = await asAgent(`/labels${query}`);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("ListMailTrainingLabels")).toHaveLength(0);
    });
  });

  it.each([
    "/accounts",
    `/examples?accountId=${ACCOUNT_ID}`,
    `/labels?accountId=${ACCOUNT_ID}`,
  ])("answers 403 on %s to a service without the agent role", async (url) => {
    const res = await asAgent(url, "agents/dionysus-asset-agent");
    expect(res.status).toBe(403);
  });

  it.each([
    "/accounts",
    `/examples?accountId=${ACCOUNT_ID}`,
    `/labels?accountId=${ACCOUNT_ID}`,
  ])("answers 403 on %s to a signed-in user, even an admin", async (url) => {
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
      .get(BASE + url)
      .set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("answers 401 without any identity", async () => {
    const res = await t.http().get(`${BASE}/accounts`);
    expect(res.status).toBe(401);
  });
});
