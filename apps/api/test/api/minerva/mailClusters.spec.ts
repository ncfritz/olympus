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
const RUN_ID = "5a660000-0000-4000-8000-0000000003a1";
const CLUSTER_ID = "5a660000-0000-4000-8000-0000000003c1";
const USER_ID = "5f1a0c6e-0000-4000-8000-000000000001";
const OTHER_USER = "5f1a0c6e-0000-4000-8000-0000000000ff";
const SHOPPING = "c1000000-0000-4000-8000-000000000001";
const TRAVEL = "c1000000-0000-4000-8000-000000000002";
const M1 = "a1000000-0000-4000-8000-000000000001";
const M2 = "a1000000-0000-4000-8000-000000000002";

const BASE = "/v1/minerva/mail";
const RUNS = `${BASE}/cluster-runs`;
const CLUSTERS = `${BASE}/cluster-run/${RUN_ID}/clusters`;
const MEMBERS = `${BASE}/cluster-run/${RUN_ID}/members`;
const POINTS = `${BASE}/cluster-run/${RUN_ID}/points`;
const PUBLISH = `${BASE}/cluster-run/${RUN_ID}/publish`;

const run = (overrides: Record<string, unknown> = {}) => ({
  id: RUN_ID,
  accountId: ACCOUNT_ID,
  embeddingVersion: "nomic-embed-text-384",
  status: "building",
  startedTime: "2026-10-06T08:00:00+00:00",
  finishedTime: null,
  messages: null,
  ...overrides,
});

/* Synthetic mail (never real). */
const cluster = (overrides: Record<string, unknown> = {}) => ({
  number: 0,
  scope: "unlabelled",
  name: "Mail from shop.example",
  size: 120,
  purity: 0,
  x: 0.25,
  y: 0.75,
  suggestion: "new-label",
  proposedName: "Shop",
  labels: [],
  senders: [{ sender: "orders@shop.example", messages: 100 }],
  ...overrides,
});

const stored = (overrides: Record<string, unknown> = {}) => ({
  id: CLUSTER_ID,
  number: 0,
  scope: "label",
  scopeLabel: { name: "Shopping" },
  name: "Shopping: shop.example",
  size: 140,
  purity: "0.950",
  x: 0.25,
  y: 0.75,
  suggestion: "split",
  proposedName: "Shopping/Shop",
  run: { accountId: ACCOUNT_ID },
  labels: [{ messages: 133, label: { name: "Shopping" } }],
  senders: [{ sender: "orders@shop.example", messages: 120 }],
  ...overrides,
});

/**
 * Clusters of mail (docs/plans/email-management phase 6): the classifier
 * posts runs (agents only, over the services listener); the site reads
 * the newest (signed in).
 */
describe("Mail clusters", () => {
  let t: TestApp;
  let server: Server;
  let port: number;
  let current: ReturnType<typeof run> | null;

  const asAgent = (
    url: string,
    body: unknown,
    name = "agents/minerva-mail-ml",
  ) =>
    new Promise<{ status?: number; body: string }>((resolve, reject) => {
      const payload = JSON.stringify(body);
      const request = https.request(
        {
          host: "127.0.0.1",
          port,
          path: url,
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

  const tokenFor = (sub: string, roles = ["user"]) =>
    issueAccessToken(t.app.get(SigningKeyService).require(), {
      sub,
      clientId: "olympus-site",
      sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
      roles,
      authTime: 1_790_000_000,
    });

  const asUser = async (url: string, sub = USER_ID) =>
    t
      .http()
      .get(url)
      .set("authorization", `Bearer ${await tokenFor(sub)}`);

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

  beforeEach(() => {
    t.reset();
    current = run();
    t.graphql.on("DescribeMailClusterAccount", (vars) => ({
      minerva_mail_accounts_by_pk:
        (vars as { accountId: string }).accountId === ACCOUNT_ID
          ? { id: ACCOUNT_ID }
          : null,
    }));
    t.graphql.on("DescribeMailClusterRun", () => ({
      minerva_mail_cluster_runs_by_pk: current,
    }));
    t.graphql.on("CreateMailClusterRun", {
      insert_minerva_mail_cluster_runs_one: run(),
    });
    t.graphql.on("ListMailClusterLabels", (vars) => ({
      minerva_mail_labels: [
        { id: SHOPPING, name: "Shopping" },
        { id: TRAVEL, name: "Travel" },
      ].filter((l) => (vars as { names: string[] }).names.includes(l.name)),
    }));
    t.graphql.on("CreateMailClusters", {
      insert_minerva_mail_clusters: { affected_rows: 1 },
    });
    t.graphql.on("DescribeMailClusterForMembers", (vars) => ({
      minerva_mail_clusters:
        (vars as { number: number }).number === 0 ? [{ id: CLUSTER_ID }] : [],
      minerva_mail_messages: [{ id: M1 }, { id: M2 }],
    }));
    t.graphql.on("CreateMailClusterMembers", {
      insert_minerva_mail_cluster_members: { affected_rows: 2 },
    });
    t.graphql.on("DescribeMailClusterPointTargets", {
      minerva_mail_clusters: [{ id: CLUSTER_ID, number: 0 }],
      minerva_mail_messages: [
        { id: M1, gmailId: "19be00000000a1" },
        { id: M2, gmailId: "19be00000000a2" },
      ],
    });
    t.graphql.on("CreateMailClusterPoints", {
      insert_minerva_mail_cluster_points: { affected_rows: 2 },
    });
    t.graphql.on("PublishMailClusterRun", {
      update_minerva_mail_cluster_runs_by_pk: run({
        status: "ready",
        finishedTime: "2026-10-06T08:10:00+00:00",
        messages: 250000,
      }),
      delete_minerva_mail_cluster_runs: { affected_rows: 1 },
    });
  });

  describe("CreateMailClusterRun", () => {
    it("begins a building run for the account", async () => {
      const res = await asAgent(RUNS, {
        accountId: ACCOUNT_ID,
        embeddingVersion: "nomic-embed-text-384",
      });
      expect(res.status).toBe(201);
      expect(JSON.parse(res.body).run).toMatchObject({
        id: RUN_ID,
        status: "building",
        embeddingVersion: "nomic-embed-text-384",
      });
      expect(t.graphql.calls("CreateMailClusterRun")[0].variables).toEqual({
        run: {
          accountId: ACCOUNT_ID,
          embeddingVersion: "nomic-embed-text-384",
        },
      });
    });

    it("answers 404 for an account that does not exist", async () => {
      const res = await asAgent(RUNS, {
        accountId: "7b2b0000-0000-4000-8000-0000000000ff",
        embeddingVersion: "v",
      });
      expect(res.status).toBe(404);
      expect(t.graphql.calls("CreateMailClusterRun")).toHaveLength(0);
    });

    it.each([
      ["no accountId", { embeddingVersion: "v" }],
      ["no embeddingVersion", { accountId: ACCOUNT_ID }],
      [
        "an embeddingVersion past 100",
        { accountId: ACCOUNT_ID, embeddingVersion: "v".repeat(101) },
      ],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await asAgent(RUNS, body);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeMailClusterAccount")).toHaveLength(0);
    });
  });

  describe("CreateMailClusters", () => {
    it("stores clusters by label name, leaving out what the account lacks", async () => {
      const res = await asAgent(CLUSTERS, {
        clusters: [
          cluster(),
          cluster({
            number: 1,
            scope: "label",
            scopeLabel: "Shopping",
            name: "Shopping: shop.example",
            purity: 0.95,
            suggestion: "split",
            proposedName: "Shopping/Shop",
            labels: [
              { label: "Shopping", messages: 114 },
              { label: "Gone", messages: 3 },
            ],
          }),
          cluster({
            number: 2,
            scope: "label",
            scopeLabel: "Gone",
            name: "Gone",
            suggestion: undefined,
            proposedName: undefined,
          }),
        ],
      });
      expect(res.status).toBe(201);
      expect(JSON.parse(res.body)).toEqual({ created: 2, skipped: 1 });
      const rows = (
        t.graphql.calls("CreateMailClusters")[0].variables as {
          clusters: Record<string, unknown>[];
        }
      ).clusters;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        runId: RUN_ID,
        number: 0,
        scope: "unlabelled",
        suggestion: "new-label",
        proposedName: "Shop",
        labels: { data: [] },
        senders: { data: [{ sender: "orders@shop.example", messages: 100 }] },
      });
      expect(rows[0]).not.toHaveProperty("scopeLabelId");
      expect(rows[1]).toMatchObject({
        number: 1,
        scopeLabelId: SHOPPING,
        purity: 0.95,
        labels: { data: [{ labelId: SHOPPING, messages: 114 }] },
      });
    });

    it.each([
      ["no clusters", { clusters: [] }],
      [
        "a label's cluster without its label",
        {
          clusters: [
            cluster({
              scope: "label",
              suggestion: undefined,
              proposedName: undefined,
            }),
          ],
        },
      ],
      [
        "a scope label on unlabelled mail",
        { clusters: [cluster({ scopeLabel: "Shopping" })] },
      ],
      [
        "a split of unlabelled mail",
        { clusters: [cluster({ suggestion: "split" })] },
      ],
      [
        "a suggestion without its name",
        { clusters: [cluster({ proposedName: undefined })] },
      ],
      [
        "a name without a suggestion",
        { clusters: [cluster({ suggestion: undefined })] },
      ],
      ["a purity past 1", { clusters: [cluster({ purity: 1.5 })] }],
      [
        "eleven senders",
        {
          clusters: [
            cluster({
              senders: Array.from({ length: 11 }, (_, i) => ({
                sender: `s${i}@shop.example`,
                messages: 1,
              })),
            }),
          ],
        },
      ],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await asAgent(CLUSTERS, body);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeMailClusterRun")).toHaveLength(0);
    });

    it("answers 409 for a published run", async () => {
      current = run({ status: "ready" });
      const res = await asAgent(CLUSTERS, { clusters: [cluster()] });
      expect(res.status).toBe(409);
      expect(t.graphql.calls("CreateMailClusters")).toHaveLength(0);
    });

    it("answers 404 for a run that does not exist", async () => {
      current = null;
      const res = await asAgent(CLUSTERS, { clusters: [cluster()] });
      expect(res.status).toBe(404);
    });
  });

  describe("CreateMailClusterMembers", () => {
    it("stores the messages the account has and counts the rest", async () => {
      const res = await asAgent(MEMBERS, {
        cluster: 0,
        gmailIds: ["19be00000000a1", "19be00000000a2", "19be0000000000ff"],
      });
      expect(res.status).toBe(201);
      expect(JSON.parse(res.body)).toEqual({ created: 2, skipped: 1 });
      expect(
        t.graphql.calls("DescribeMailClusterForMembers")[0].variables,
      ).toEqual({
        runId: RUN_ID,
        number: 0,
        accountId: ACCOUNT_ID,
        gmailIds: ["19be00000000a1", "19be00000000a2", "19be0000000000ff"],
      });
      expect(t.graphql.calls("CreateMailClusterMembers")[0].variables).toEqual({
        members: [
          { clusterId: CLUSTER_ID, messageId: M1 },
          { clusterId: CLUSTER_ID, messageId: M2 },
        ],
      });
    });

    it("answers 404 for a cluster the run does not have", async () => {
      const res = await asAgent(MEMBERS, {
        cluster: 7,
        gmailIds: ["19be00000000a1"],
      });
      expect(res.status).toBe(404);
      expect(t.graphql.calls("CreateMailClusterMembers")).toHaveLength(0);
    });

    it.each([
      ["no cluster", { gmailIds: ["1a"] }],
      ["no messages", { cluster: 0, gmailIds: [] }],
      ["an ID that is not Gmail's", { cluster: 0, gmailIds: ["NOT-HEX"] }],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await asAgent(MEMBERS, body);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeMailClusterRun")).toHaveLength(0);
    });
  });

  describe("CreateMailClusterPoints", () => {
    it("places the messages the account has, in their clusters", async () => {
      const res = await asAgent(POINTS, {
        points: [
          { gmailId: "19be00000000a1", x: 0.1, y: 0.2, cluster: 0 },
          { gmailId: "19be00000000a2", x: 0.3, y: 0.4, cluster: 9 },
          { gmailId: "19be0000000000ff", x: 0.5, y: 0.6 },
        ],
      });
      expect(res.status).toBe(201);
      expect(JSON.parse(res.body)).toEqual({ created: 2, skipped: 1 });
      expect(t.graphql.calls("CreateMailClusterPoints")[0].variables).toEqual({
        points: [
          {
            runId: RUN_ID,
            messageId: M1,
            x: 0.1,
            y: 0.2,
            clusterId: CLUSTER_ID,
          },
          // Cluster 9 is not in the run: the point stands alone.
          { runId: RUN_ID, messageId: M2, x: 0.3, y: 0.4 },
        ],
      });
    });

    it.each([
      ["no points", { points: [] }],
      ["a point off the map", { points: [{ gmailId: "1a", x: 1.2, y: 0 }] }],
      [
        "a negative cluster",
        { points: [{ gmailId: "1a", x: 0, y: 0, cluster: -1 }] },
      ],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await asAgent(POINTS, body);
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeMailClusterRun")).toHaveLength(0);
    });
  });

  describe("PublishMailClusterRun", () => {
    it("publishes the run and drops the account's runs before it", async () => {
      const res = await asAgent(PUBLISH, { messages: 250000 });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).run).toMatchObject({
        status: "ready",
        messages: 250000,
        finishedTime: "2026-10-06T08:10:00.000Z",
      });
      expect(
        t.graphql.calls("PublishMailClusterRun")[0].variables,
      ).toMatchObject({
        runId: RUN_ID,
        accountId: ACCOUNT_ID,
        messages: 250000,
      });
    });

    it("answers 409 for a run published already", async () => {
      current = run({ status: "ready" });
      const res = await asAgent(PUBLISH, { messages: 1 });
      expect(res.status).toBe(409);
      expect(t.graphql.calls("PublishMailClusterRun")).toHaveLength(0);
    });

    it("answers 400 to a fractional count, before Hasura", async () => {
      const res = await asAgent(PUBLISH, { messages: 1.5 });
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeMailClusterRun")).toHaveLength(0);
    });
  });

  it.each([RUNS, CLUSTERS, MEMBERS, POINTS, PUBLISH])(
    "answers 403 on %s to a service without the agent role",
    async (url) => {
      const res = await asAgent(url, {}, "agents/dionysus-asset-agent");
      expect(res.status).toBe(403);
    },
  );

  it.each([RUNS, CLUSTERS, MEMBERS, POINTS, PUBLISH])(
    "answers 403 on %s to a signed-in user, even an admin",
    async (url) => {
      const token = await tokenFor(USER_ID, ["user", "admin"]);
      const res = await t
        .http()
        .post(url)
        .set("authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(403);
    },
  );

  describe("GetMailClusterMap", () => {
    const published = run({
      status: "ready",
      finishedTime: "2026-10-06T08:10:00+00:00",
      messages: 250000,
    });

    it("gives the newest run's clusters and points, each coloured by its first label", async () => {
      t.graphql.on("GetMailClusterMap", {
        minerva_mail_cluster_runs: [
          {
            ...published,
            clusters: [stored()],
            points: [
              {
                x: 0.1,
                y: 0.2,
                clusterId: CLUSTER_ID,
                message: {
                  gmailId: "19be00000000a1",
                  messageLabels: [{ label: { name: "Shopping" } }],
                },
              },
              {
                x: 0.3,
                y: 0.4,
                clusterId: null,
                message: { gmailId: "19be00000000a2", messageLabels: [] },
              },
            ],
          },
        ],
      });
      const res = await asUser(`${BASE}/clusters?accountId=${ACCOUNT_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.run).toMatchObject({ id: RUN_ID, status: "ready" });
      expect(res.body.clusters).toEqual([
        {
          id: CLUSTER_ID,
          accountId: ACCOUNT_ID,
          number: 0,
          scope: "label",
          scopeLabel: "Shopping",
          name: "Shopping: shop.example",
          size: 140,
          purity: 0.95,
          x: 0.25,
          y: 0.75,
          suggestion: "split",
          proposedName: "Shopping/Shop",
          labels: [{ label: "Shopping", messages: 133 }],
          senders: [{ sender: "orders@shop.example", messages: 120 }],
        },
      ]);
      expect(res.body.points).toEqual([
        {
          gmailId: "19be00000000a1",
          x: 0.1,
          y: 0.2,
          clusterId: CLUSTER_ID,
          label: "Shopping",
        },
        { gmailId: "19be00000000a2", x: 0.3, y: 0.4 },
      ]);
      expect(t.graphql.calls("GetMailClusterMap")[0].variables).toEqual({
        where: {
          status: { _eq: "ready" },
          account: { userId: { _eq: USER_ID } },
          accountId: { _eq: ACCOUNT_ID },
        },
      });
    });

    it("is empty before the first run", async () => {
      t.graphql.on("GetMailClusterMap", { minerva_mail_cluster_runs: [] });
      const res = await asUser(`${BASE}/clusters`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ clusters: [], points: [] });
    });

    it("answers 400 to an account that is not an ID", async () => {
      const res = await asUser(`${BASE}/clusters?accountId=7b2b`);
      expect(res.status).toBe(400);
    });

    it("answers 401 without a token", async () => {
      const res = await t.http().get(`${BASE}/clusters`);
      expect(res.status).toBe(401);
    });
  });

  describe("DescribeMailCluster", () => {
    it("gives the cluster and its newest messages' metadata", async () => {
      t.graphql.on("DescribeMailCluster", (vars) => ({
        minerva_mail_clusters:
          (vars as { userId: string }).userId === USER_ID
            ? [
                {
                  ...stored(),
                  members: [
                    {
                      message: {
                        gmailId: "19be00000000a1",
                        fromAddress: "orders@shop.example",
                        subject: "Your order has shipped",
                        receivedTime: "2026-10-05T09:00:00+00:00",
                        messageLabels: [
                          { label: { name: "Shopping" } },
                          { label: { name: "Accounts/A" } },
                        ],
                      },
                    },
                  ],
                },
              ]
            : [],
      }));
      const res = await asUser(`${BASE}/cluster/${CLUSTER_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.cluster.id).toBe(CLUSTER_ID);
      expect(res.body.messages).toEqual([
        {
          gmailId: "19be00000000a1",
          fromAddress: "orders@shop.example",
          subject: "Your order has shipped",
          receivedTime: "2026-10-05T09:00:00.000Z",
          labels: ["Accounts/A", "Shopping"],
        },
      ]);
      const other = await asUser(`${BASE}/cluster/${CLUSTER_ID}`, OTHER_USER);
      expect(other.status).toBe(404);
    });
  });

  describe("ListMailClusterMembers", () => {
    beforeEach(() => {
      t.graphql.on("ListMailClusterMembers", {
        minerva_mail_clusters: [
          {
            id: CLUSTER_ID,
            members_aggregate: { aggregate: { count: 140 } },
            members: [
              { message: { gmailId: "19be00000000a1" } },
              { message: { gmailId: "19be00000000a2" } },
            ],
          },
        ],
      });
    });

    it("gives a page of its Gmail IDs and how many it has", async () => {
      const res = await asUser(
        `${BASE}/cluster/${CLUSTER_ID}/members?offset=100&limit=2`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        gmailIds: ["19be00000000a1", "19be00000000a2"],
        count: 140,
      });
      expect(t.graphql.calls("ListMailClusterMembers")[0].variables).toEqual({
        clusterId: CLUSTER_ID,
        userId: USER_ID,
        offset: 100,
        limit: 2,
      });
    });

    it.each(["limit=0", "limit=5001", "offset=-1"])(
      "answers 400 to %s",
      async (query) => {
        const res = await asUser(
          `${BASE}/cluster/${CLUSTER_ID}/members?${query}`,
        );
        expect(res.status).toBe(400);
        expect(t.graphql.calls("ListMailClusterMembers")).toHaveLength(0);
      },
    );
  });

  describe("ListMailClusterSuggestions", () => {
    beforeEach(() => {
      t.graphql.on("ListMailClusterSuggestions", {
        minerva_mail_clusters: [stored()],
      });
    });

    it("lists what the newest runs suggest", async () => {
      const res = await asUser(`${BASE}/cluster-suggestions`);
      expect(res.status).toBe(200);
      expect(res.body.clusters).toHaveLength(1);
      expect(
        t.graphql.calls("ListMailClusterSuggestions")[0].variables,
      ).toEqual({
        where: {
          suggestion: { _is_null: false },
          run: {
            status: { _eq: "ready" },
            account: { userId: { _eq: USER_ID } },
          },
        },
      });
    });

    it("lists one label's splits", async () => {
      const res = await asUser(
        `${BASE}/cluster-suggestions?label=${encodeURIComponent("Shopping")}`,
      );
      expect(res.status).toBe(200);
      expect(
        t.graphql.calls("ListMailClusterSuggestions")[0].variables,
      ).toEqual({
        where: {
          suggestion: { _eq: "split" },
          run: {
            status: { _eq: "ready" },
            account: { userId: { _eq: USER_ID } },
          },
          scopeLabel: { name: { _eq: "Shopping" } },
        },
      });
    });
  });
});
