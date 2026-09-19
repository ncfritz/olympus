import * as fs from "node:fs";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { storedFilename } from "../../../src/dionysus/content/workflows/uploadStorage";
import {
  graphQlIngestStep,
  graphQlIngestWorkflow,
  INGEST_ID,
  INGEST_STEP_ID,
} from "../../fixtures/content";
import { aggregate } from "../../fixtures/dionysus";
import { createTestApp, type TestApp } from "../../support/testApp";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const TODAY = Date.parse("2026-09-18T00:00:00.000Z");
const WORKFLOW = `/v1/dionysus/content/workflow/${INGEST_ID}`;
const UPLOAD_DIR = process.env.DIONYSUS_UPLOAD_PATH!;

const workflowExists = {
  dionysus_content_asset_ingest_workflows_by_pk: { id: INGEST_ID },
};

describe("Dionysus content ingestion workflows API", () => {
  let t: TestApp;
  beforeAll(async () => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
    fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  });
  beforeEach(() => t.reset());

  describe("POST /v1/dionysus/content/workflows (CreateContentIngestionWorkflow)", () => {
    it("queues a workflow and starts the raw ingest", async () => {
      t.graphql.on("CreateContentIngestionWorkflow", {
        insert_dionysus_content_asset_ingest_workflows_one:
          graphQlIngestWorkflow({
            sourceType: "remote" as never,
            source: "https://example.com/a.mp4",
          }),
      });

      const res = await t
        .http()
        .post("/v1/dionysus/content/workflows")
        .send({
          workflow: {
            source: "https://example.com/a.mp4",
            sourceType: "remote",
          },
        });

      expect(res.status).toBe(201);
      expect(
        t.graphql.calls("CreateContentIngestionWorkflow")[0].variables,
      ).toEqual({
        source: "https://example.com/a.mp4",
        sourceType: "remote",
        status: "queued",
      });
      expect(t.amqp.publish).toHaveBeenCalledWith(
        "content.trigger",
        "jobType.rawIngest",
        {
          workflowId: INGEST_ID,
          assetLocation: "https://example.com/a.mp4",
          skipWorkflow: false,
        },
      );
    });
  });

  describe("POST /v1/dionysus/content/upload (UploadAssets)", () => {
    beforeEach(() => {
      t.graphql.on("CreateContentIngestionWorkflow", {
        insert_dionysus_content_asset_ingest_workflows_one:
          graphQlIngestWorkflow(),
      });
    });

    it("stores each file and starts a workflow for it", async () => {
      const res = await t
        .http()
        .post("/v1/dionysus/content/upload")
        .attach("files", Buffer.from("one"), "clip one.mov")
        .attach("files", Buffer.from("two"), "clip2.mov");

      expect(res.status).toBe(201);
      expect(res.body.workflows).toHaveLength(2);
      expect(
        t.graphql
          .calls("CreateContentIngestionWorkflow")
          .map((c) => c.variables),
      ).toEqual([
        { source: "clip one.mov", sourceType: "local", status: "queued" },
        { source: "clip2.mov", sourceType: "local", status: "queued" },
      ]);
      const [, , message] = t.amqp.publish.mock.calls[0];
      expect(message).toMatchObject({
        workflowId: INGEST_ID,
        originalFilename: "clip one.mov",
      });
      const stored = String(message.assetLocation).split("/").pop()!;
      expect(stored).toMatch(/^[0-9a-f]{32}-clip one\.mov$/);
      expect(fs.readFileSync(`${UPLOAD_DIR}/${stored}`, "utf8")).toBe("one");
    });

    it("keeps uploads inside the upload directory", async () => {
      await t
        .http()
        .post("/v1/dionysus/content/upload")
        .attach("files", Buffer.from("x"), "../../escape.mov")
        .expect(201);

      const [, , message] = t.amqp.publish.mock.calls[0];
      const stored = String(message.assetLocation).split("/").pop()!;
      expect(fs.existsSync(`${UPLOAD_DIR}/${stored}`)).toBe(true);
      expect(stored).toMatch(/^[0-9a-f]{32}-escape\.mov$/);
    });

    it("rejects a request without files", async () => {
      await t.http().post("/v1/dionysus/content/upload").expect(400);

      expect(t.graphql.request).not.toHaveBeenCalled();
    });

    it.each([
      ["../../etc/passwd", "passwd"],
      ["..\\..\\win.ini", "win.ini"],
      [".hidden", "_hidden"],
      ["a/b/c$(rm).mov", "c__rm_.mov"],
      ["..", "_"],
    ])("stores %s as a safe name", (name, safe) => {
      expect(storedFilename(name)).toMatch(
        new RegExp(`^[0-9a-f]{32}-${safe.replace(/\./g, "\\.")}$`),
      );
    });
  });

  describe("POST .../workflow/:workflowId/steps (CreateContentIngestionWorkflowStep)", () => {
    it("starts a step", async () => {
      t.graphql.on("GetParentContentIngestionWorkflow", workflowExists);
      t.graphql.on("CreateContentIngestionWorkflowStep", {
        insert_dionysus_content_asset_ingest_workflow_steps_one:
          graphQlIngestStep(),
      });

      const res = await t
        .http()
        .post(`${WORKFLOW}/steps`)
        .send({ step: { type: "transcode" } });

      expect(res.status).toBe(201);
      expect(
        t.graphql.calls("CreateContentIngestionWorkflowStep")[0].variables,
      ).toMatchObject({
        workflowId: INGEST_ID,
        workflowStepType: "transcode",
        workflowStepStatus: "running",
        progress: 0,
      });
    });

    it("returns 404 for an unknown workflow", async () => {
      t.graphql.on("GetParentContentIngestionWorkflow", {
        dionysus_content_asset_ingest_workflows_by_pk: null,
      });

      await t
        .http()
        .post("/v1/dionysus/content/workflow/missing/steps")
        .send({ step: { type: "transcode" } })
        .expect(404);
    });
  });

  describe("GET /v1/dionysus/content/workflow/:workflowId (DescribeContentIngestionWorkflow)", () => {
    it("returns the workflow with its steps", async () => {
      t.graphql.on("DescribeContentIngestionWorkflow", {
        dionysus_content_asset_ingest_workflows_by_pk: graphQlIngestWorkflow({
          steps: [graphQlIngestStep()],
        }),
      });

      const res = await t.http().get(WORKFLOW);

      expect(res.status).toBe(200);
      expect(res.body.workflow.steps[0].id).toBe(INGEST_STEP_ID);
    });

    it("returns 404 for an unknown workflow", async () => {
      t.graphql.on("DescribeContentIngestionWorkflow", {
        dionysus_content_asset_ingest_workflows_by_pk: null,
      });

      await t.http().get("/v1/dionysus/content/workflow/missing").expect(404);
    });
  });

  describe("PUT /v1/dionysus/content/workflow/:workflowId (UpdateContentIngestionWorkflow)", () => {
    afterEach(() => vi.useRealTimers());

    it("stamps finishedTime when the workflow ends", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      t.graphql.on("UpdateContentIngestionWorkflow", {
        update_dionysus_content_asset_ingest_workflows_by_pk:
          graphQlIngestWorkflow(),
      });

      await t
        .http()
        .put(WORKFLOW)
        .send({ workflow: { status: "duplicate" } })
        .expect(200);
      await t
        .http()
        .put(WORKFLOW)
        .send({ workflow: { status: "success" } })
        .expect(200);

      const [dup, success] = t.graphql
        .calls("UpdateContentIngestionWorkflow")
        .map((c) => JSON.parse(JSON.stringify(c.variables)));
      expect(dup.changes).toEqual({ status: "duplicate" });
      expect(success.changes).toEqual({
        status: "success",
        finishedTime: NOW.toISOString(),
      });
    });

    it("returns 404 for an unknown workflow", async () => {
      t.graphql.on("UpdateContentIngestionWorkflow", {
        update_dionysus_content_asset_ingest_workflows_by_pk: null,
      });

      await t
        .http()
        .put("/v1/dionysus/content/workflow/missing")
        .send({ workflow: { status: "running" } })
        .expect(404);
    });
  });

  describe("PUT .../steps/:workflowStepId (UpdateContentIngestionWorkflowStep)", () => {
    it("applies the changes", async () => {
      t.graphql.on("GetParentContentIngestionWorkflow", workflowExists);
      t.graphql.on("GetParentContentIngestionWorkflowStep", {
        dionysus_content_asset_ingest_workflow_steps_by_pk: {
          id: INGEST_STEP_ID,
        },
      });
      t.graphql.on("UpdateContentIngestionWorkflowStep", {
        update_dionysus_content_asset_ingest_workflow_steps_by_pk:
          graphQlIngestStep({ progress: 50 }),
      });

      const res = await t
        .http()
        .put(`${WORKFLOW}/steps/${INGEST_STEP_ID}`)
        .send({ step: { progress: 50 } });

      expect(res.status).toBe(200);
      expect(
        t.graphql.calls("UpdateContentIngestionWorkflowStep")[0].variables,
      ).toEqual({
        id: INGEST_STEP_ID,
        workflowId: INGEST_ID,
        changes: { progress: 50 },
      });
    });

    it("returns 404 for an unknown step", async () => {
      t.graphql.on("GetParentContentIngestionWorkflow", workflowExists);
      t.graphql.on("GetParentContentIngestionWorkflowStep", {
        dionysus_content_asset_ingest_workflow_steps_by_pk: null,
      });

      await t
        .http()
        .put(`${WORKFLOW}/steps/missing`)
        .send({ step: { progress: 50 } })
        .expect(404);
    });
  });

  describe("GET /v1/dionysus/content/workflows (ListContentIngestionWorkflows)", () => {
    it("returns a page of workflows", async () => {
      t.graphql.on("ListContentIngestionWorkflows", {
        dionysus_content_asset_ingest_workflows: [
          graphQlIngestWorkflow({
            steps: undefined,
            steps_aggregate: aggregate(3),
          }),
        ],
        dionysus_content_asset_ingest_workflows_aggregate: aggregate(8),
      });

      const res = await t.http().get("/v1/dionysus/content/workflows");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(8);
      expect(res.body.workflows[0].stepCount).toBe(3);
    });
  });

  describe("GET /v1/dionysus/content/workflow/stats (GetContentIngestionWorkflowStatistics)", () => {
    afterEach(() => vi.useRealTimers());

    it("returns 30 days of status counts and totals", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      t.graphql.on("GetContentIngestionWorkflowStatistics", {
        dionysus_content_asset_ingest_workflow_status_statistics: [
          { createdTime: "2026-09-18", status: "success", count: 4 },
          { createdTime: "2026-09-18", status: "mystery", count: 1 },
          { createdTime: "2025-01-01", status: "failed", count: 9 },
        ],
        dionysus_content_asset_ingest_workflow_status_aggregate: [
          { status: "success", count: 40 },
        ],
        dionysus_content_asset_ingest_workflow_source_aggregate: [
          { sourceType: "local", count: 30 },
        ],
      });

      const res = await t.http().get("/v1/dionysus/content/workflow/stats");

      expect(res.status).toBe(200);
      const { status, statusAggregate, sourceAggregate } = res.body.series;
      expect(status.success).toHaveLength(30);
      expect(status.success[29]).toEqual([TODAY, 4]);
      expect(status.failed.every(([, n]: number[]) => n === 0)).toBe(true);
      expect(statusAggregate).toMatchObject({ success: 40, failed: 0 });
      expect(sourceAggregate).toEqual({ remote: 0, local: 30 });
    });
  });
});
