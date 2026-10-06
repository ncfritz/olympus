import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import type { Server } from "https";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as jose from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServicesListener } from "../../../src/auth/servicesListener";
import { devCa, identity, servicesConfig } from "../../support/devCa";
import { createTestApp, type TestApp } from "../../support/testApp";

const ACCOUNT_ID = "7b2b0000-0000-4000-8000-000000000001";
const MISSING = "7b2b0000-0000-4000-8000-0000000000ff";
const BASE = `/v1/minerva/mail/account/${ACCOUNT_ID}`;

const row = (gmailId: string, overrides = {}) => ({
  gmailId,
  inInbox: true,
  unread: false,
  starred: false,
  important: true,
  sent: false,
  messageLabels: [
    { label: { name: "Travel", type: "user" } },
    { label: { name: "CATEGORY_UPDATES", type: "system" } },
    { label: { name: "Bills", type: "user" } },
  ],
  ...overrides,
});

/**
 * Keeping a linked mailbox in step with Gmail (docs/plans/email-management
 * phase 1b): the mail agent's operations, over the services listener.
 */
describe("Mail sync", () => {
  let t: TestApp;
  let server: Server;
  let port: number;

  const asAgent = (
    method: string,
    url: string,
    body?: unknown,
    name = "agents/minerva-mail-agent",
  ) =>
    new Promise<{ status?: number; body: string }>((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const request = https.request(
        {
          host: "127.0.0.1",
          port,
          path: url,
          method,
          servername: "localhost",
          ca: fs.readFileSync(path.join(devCa(), "services-ca.crt")),
          ...identity(name),
          headers: payload
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(payload),
              }
            : {},
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
          "minerva-mail-agent:agent,dionysus-asset-agent:content",
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
    t.graphql.on("DescribeMailSyncAccount", (vars) => ({
      minerva_mail_accounts_by_pk:
        (vars as { accountId: string }).accountId === ACCOUNT_ID
          ? { id: ACCOUNT_ID }
          : null,
    }));
  });

  describe("ListMailSyncAccounts", () => {
    it("lists linked accounts with where their history carries on", async () => {
      t.graphql.on("ListMailSyncAccounts", {
        minerva_mail_accounts: [
          { id: ACCOUNT_ID, email: "owner@example.net", historyId: 30802840 },
          { id: MISSING, email: "other@example.net", historyId: null },
        ],
      });
      const res = await asAgent("GET", "/v1/minerva/mail/sync/accounts");
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        accounts: [
          { id: ACCOUNT_ID, email: "owner@example.net", historyId: "30802840" },
          { id: MISSING, email: "other@example.net" },
        ],
      });
      expect(t.graphql.calls("ListMailSyncAccounts")).toHaveLength(1);
    });
  });

  describe("ListMailMessageStates", () => {
    it("pages messages with their labels, categories and flags", async () => {
      t.graphql.on("ListMailMessageStates", {
        minerva_mail_messages: [
          row("19be00000000a1"),
          row("19be00000000a2", { messageLabels: [] }),
        ],
      });
      const res = await asAgent(
        "GET",
        `${BASE}/message-states?limit=2&after=19be00000000a0`,
      );
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.messages[0]).toEqual({
        gmailId: "19be00000000a1",
        labels: ["Bills", "Travel"],
        categories: ["updates"],
        flags: {
          inbox: true,
          unread: false,
          starred: false,
          important: true,
          sent: false,
        },
      });
      expect(body.messages[1].labels).toEqual([]);
      expect(body.nextCursor).toBe("19be00000000a2");
      expect(t.graphql.calls("ListMailMessageStates")[0].variables).toEqual({
        where: {
          accountId: { _eq: ACCOUNT_ID },
          gmailId: { _gt: "19be00000000a0" },
        },
        limit: 2,
      });
    });

    it.each([
      ["a limit over 5000", "?limit=5001"],
      ["an after that is not a Gmail ID", "?after=zz"],
    ])("answers 400 to %s", async (_case, query) => {
      const res = await asAgent("GET", `${BASE}/message-states${query}`);
      expect(res.status).toBe(400);
    });

    it("answers 404 for an account that does not exist", async () => {
      const res = await asAgent(
        "GET",
        `/v1/minerva/mail/account/${MISSING}/message-states`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("SyncMailLabels", () => {
    it("gives labels their Gmail IDs, adds new ones and names the gone", async () => {
      t.graphql.on("ListMailLabelsForSync", {
        minerva_mail_labels: [
          { name: "Bills", type: "user" },
          { name: "Old", type: "user" },
          { name: "CATEGORY_UPDATES", type: "system" },
        ],
      });
      t.graphql.on("SyncMailLabels", {
        insert_minerva_mail_labels: { affected_rows: 3 },
      });
      const res = await asAgent("POST", `${BASE}/labels/sync`, {
        labels: [
          { gmailLabelId: "Label_1", name: "Bills", type: "user" },
          { gmailLabelId: "Label_9", name: "New since export", type: "user" },
          {
            gmailLabelId: "CATEGORY_UPDATES",
            name: "CATEGORY_UPDATES",
            type: "system",
          },
          { gmailLabelId: "INBOX", name: "INBOX", type: "system" },
        ],
      });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        matched: 2,
        created: 1,
        notInGmail: ["Old"],
      });
      expect(t.graphql.calls("SyncMailLabels")[0].variables).toEqual({
        labels: [
          {
            accountId: ACCOUNT_ID,
            name: "Bills",
            type: "user",
            gmailLabelId: "Label_1",
          },
          {
            accountId: ACCOUNT_ID,
            name: "New since export",
            type: "user",
            gmailLabelId: "Label_9",
          },
          {
            accountId: ACCOUNT_ID,
            name: "CATEGORY_UPDATES",
            type: "system",
            gmailLabelId: "CATEGORY_UPDATES",
          },
        ],
      });
    });

    it("answers 400 to a label without a type", async () => {
      const res = await asAgent("POST", `${BASE}/labels/sync`, {
        labels: [{ gmailLabelId: "Label_1", name: "Bills" }],
      });
      expect(res.status).toBe(400);
    });
  });

  describe("UpdateMailAccountSync", () => {
    it("records where history carries on, and Gmail's totals", async () => {
      t.graphql.on("UpdateMailAccountSync", {
        update_minerva_mail_accounts_by_pk: {
          id: ACCOUNT_ID,
          userId: "u",
          email: "neil@example.com",
          verificationMethod: "import",
          verifiedTime: "2026-10-05T12:00:00Z",
          linkedTime: "2026-10-06T17:00:00Z",
          linkScope: "openid",
          syncedTime: "2026-10-06T18:00:00Z",
          gmailMessagesTotal: 267362,
          gmailThreadsTotal: 250001,
        },
      });
      const res = await asAgent("PUT", `${BASE}/sync`, {
        historyId: "123456789",
        messagesTotal: 267362,
        threadsTotal: 250001,
      });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).mailAccount).toMatchObject({
        syncedTime: "2026-10-06T18:00:00.000Z",
        gmailMessagesTotal: 267362,
      });
      expect(
        t.graphql.calls("UpdateMailAccountSync")[0].variables,
      ).toMatchObject({
        id: ACCOUNT_ID,
        sync: {
          historyId: "123456789",
          gmailMessagesTotal: 267362,
          gmailThreadsTotal: 250001,
        },
      });
    });

    it.each([
      [
        "a history ID that is not digits",
        { historyId: "abc", messagesTotal: 1, threadsTotal: 1 },
      ],
      [
        "a negative total",
        { historyId: "1", messagesTotal: -1, threadsTotal: 1 },
      ],
    ])("answers 400 to %s", async (_case, body) => {
      const res = await asAgent("PUT", `${BASE}/sync`, body);
      expect(res.status).toBe(400);
    });
  });

  it("answers 403 to a service without the agent role", async () => {
    const res = await asAgent(
      "GET",
      `${BASE}/message-states`,
      undefined,
      "agents/dionysus-asset-agent",
    );
    expect(res.status).toBe(403);
  });
});
