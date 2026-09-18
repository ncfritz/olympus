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
import {
  aggregate,
  BATCH_JOB_ID,
  graphQlWorkflow,
  graphQlWorkflowStep,
  STEP_ID,
  WORKFLOW_ID,
} from "../../fixtures/dionysus";
import { base64Json } from "../../fixtures/olympus";
import { createTestApp, type TestApp } from "../../support/testApp";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const TODAY = Date.parse("2026-09-18T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("Dionysus metadata workflows API", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => {
    t.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("POST /v1/dionysus/workflows (CreateMetadataWorkflow)", () => {
    it("creates the workflow, announces it and returns 201", async () => {
      t.graphql.on("CreateMetadataWorkflow", {
        insert_dionysus_metadata_workflow_one: graphQlWorkflow({
          status: "created" as never,
          steps: [],
        }),
      });

      const res = await t.http().post("/v1/dionysus/workflows").send({});

      expect(res.status).toBe(201);
      expect(res.body.workflow).toMatchObject({
        id: WORKFLOW_ID,
        status: "created",
        stepCount: 0,
      });
      expect(t.graphql.calls("CreateMetadataWorkflow")[0].variables).toEqual({
        status: "created",
      });
      expect(t.amqp.publish).toHaveBeenCalledWith(
        "batchJob.workflow",
        "workflowCreated",
        { workflowId: WORKFLOW_ID },
        { persistent: true, headers: { "x-delay": 15000 } },
      );
    });
  });

  describe("POST /v1/dionysus/workflow/:workflowId/steps (CreateMetadataWorkflowStep)", () => {
    const body = {
      step: {
        type: "job_execution",
        attempt: 2,
        jobType: "movies",
        offset: 500,
      },
    };

    it("creates the step with its batch job and triggers the job", async () => {
      t.graphql.on("GetParentMetadataWorkflow", {
        dionysus_metadata_workflow_by_pk: { id: WORKFLOW_ID },
      });
      t.graphql.on("CreateMetadataWorkflowStep", {
        insert_dionysus_metadata_workflow_step_one: graphQlWorkflowStep({
          attempt: 2,
        }),
      });

      const res = await t
        .http()
        .post(`/v1/dionysus/workflow/${WORKFLOW_ID}/steps`)
        .send(body);

      expect(res.status).toBe(201);
      expect(res.body.step).toMatchObject({
        id: STEP_ID,
        attempt: 2,
        job: { id: BATCH_JOB_ID, type: "movies" },
      });
      expect(
        t.graphql.calls("CreateMetadataWorkflowStep")[0].variables,
      ).toEqual({
        workflowId: WORKFLOW_ID,
        workflowStepType: "job_execution",
        attempt: 2,
        batchJobType: "movies",
        batchJobStatus: "created",
      });
      expect(t.amqp.publish).toHaveBeenCalledWith(
        "batchJob.trigger",
        "jobType.movies",
        {
          jobType: "movies",
          jobId: BATCH_JOB_ID,
          workflowId: WORKFLOW_ID,
          stepId: STEP_ID,
          offset: 500,
          attempt: 2,
        },
      );
    });

    it("returns 404 when the workflow does not exist", async () => {
      t.graphql.on("GetParentMetadataWorkflow", {
        dionysus_metadata_workflow_by_pk: null,
      });

      await t
        .http()
        .post("/v1/dionysus/workflow/missing/steps")
        .send(body)
        .expect(404);

      expect(t.graphql.calls("CreateMetadataWorkflowStep")).toHaveLength(0);
      expect(t.amqp.publish).not.toHaveBeenCalled();
    });
  });

  describe("GET /v1/dionysus/workflow/:workflowId (DescribeMetadataWorkflow)", () => {
    it("returns the workflow with its steps", async () => {
      t.graphql.on("DescribeMetadataWorkflow", {
        dionysus_metadata_workflow_by_pk: graphQlWorkflow(),
      });

      const res = await t.http().get(`/v1/dionysus/workflow/${WORKFLOW_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.workflow).toMatchObject({
        id: WORKFLOW_ID,
        stepCount: 1,
        steps: [{ id: STEP_ID, job: { id: BATCH_JOB_ID } }],
      });
      expect(res.body.workflow.finishedTime).toBeUndefined();
    });

    it("returns 404 for an unknown workflow", async () => {
      t.graphql.on("DescribeMetadataWorkflow", {
        dionysus_metadata_workflow_by_pk: null,
      });

      await t.http().get("/v1/dionysus/workflow/missing").expect(404);
    });
  });

  describe("GET /v1/dionysus/workflow/:workflowId/step/:stepId (DescribeMetadataWorkflowStep)", () => {
    it("returns the step", async () => {
      t.graphql.on("DescribeMetadataWorkflowStep", {
        dionysus_metadata_workflow_step_by_pk: graphQlWorkflowStep(),
      });

      const res = await t
        .http()
        .get(`/v1/dionysus/workflow/${WORKFLOW_ID}/step/${STEP_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.step.id).toBe(STEP_ID);
      expect(
        t.graphql.calls("DescribeMetadataWorkflowStep")[0].variables,
      ).toEqual({ workflowId: WORKFLOW_ID, stepId: STEP_ID });
    });

    it("returns 404 for an unknown step", async () => {
      t.graphql.on("DescribeMetadataWorkflowStep", {
        dionysus_metadata_workflow_step_by_pk: null,
      });

      await t
        .http()
        .get(`/v1/dionysus/workflow/${WORKFLOW_ID}/step/missing`)
        .expect(404);
    });
  });

  describe("GET /v1/dionysus/workflow/:workflowId/steps (ListMetadataWorkflowSteps)", () => {
    it("lists the workflow's steps", async () => {
      t.graphql.on("ListMetadataWorkflowSteps", {
        dionysus_metadata_workflow_step: [
          graphQlWorkflowStep(),
          graphQlWorkflowStep({ id: "step-2", type: "retry" as never }),
        ],
      });

      const res = await t
        .http()
        .get(`/v1/dionysus/workflow/${WORKFLOW_ID}/steps`);

      expect(res.status).toBe(200);
      expect(res.body.steps.map((s: { type: string }) => s.type)).toEqual([
        "job_execution",
        "retry",
      ]);
      expect(t.graphql.calls("ListMetadataWorkflowSteps")[0].variables).toEqual(
        { workflowId: WORKFLOW_ID },
      );
    });
  });

  describe("GET /v1/dionysus/workflows (ListMetadataWorkflows)", () => {
    beforeEach(() => {
      t.graphql.on("ListMetadataWorkflows", {
        dionysus_metadata_workflow: [
          graphQlWorkflow({
            steps: undefined,
            steps_aggregate: aggregate(4),
          }),
        ],
        dionysus_metadata_workflow_aggregate: aggregate(17),
      });
    });
    const document = () => t.graphql.calls("ListMetadataWorkflows")[0].document;

    it("returns a page of workflows with step counts", async () => {
      const res = await t.http().get("/v1/dionysus/workflows");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(17);
      expect(res.body.workflows[0]).toMatchObject({ stepCount: 4, steps: [] });
      expect(document()).toContain(
        "limit: 100, offset: 0, order_by: [{createdTime: desc}]",
      );
    });

    it("applies filters", async () => {
      await t
        .http()
        .get("/v1/dionysus/workflows")
        .query({
          filters: base64Json({ type: "eq", name: "status", value: "failed" }),
        })
        .expect(200);

      expect(document()).toContain(
        'dionysus_metadata_workflow_aggregate(where: {status: {_eq: "failed"}})',
      );
    });

    it("rejects an invalid sort field", async () => {
      await t
        .http()
        .get("/v1/dionysus/workflows?sortBy=id%7D%20x%3A%20%7B")
        .expect(400);

      expect(t.graphql.calls("ListMetadataWorkflows")).toHaveLength(0);
    });
  });

  describe("PUT /v1/dionysus/workflow/:workflowId (UpdateMetadataWorkflow)", () => {
    it("applies the changes and returns the workflow", async () => {
      t.graphql.on("UpdateMetadataWorkflow", {
        update_dionysus_metadata_workflow_by_pk: graphQlWorkflow({
          status: "success" as never,
        }),
      });

      const res = await t
        .http()
        .put(`/v1/dionysus/workflow/${WORKFLOW_ID}`)
        .send({ workflow: { status: "success" } });

      expect(res.status).toBe(200);
      expect(res.body.workflow.status).toBe("success");
      expect(t.graphql.calls("UpdateMetadataWorkflow")[0].variables).toEqual({
        id: WORKFLOW_ID,
        changes: { status: "success" },
      });
    });

    it("returns 404 for an unknown workflow", async () => {
      t.graphql.on("UpdateMetadataWorkflow", {
        update_dionysus_metadata_workflow_by_pk: null,
      });

      await t
        .http()
        .put("/v1/dionysus/workflow/missing")
        .send({ workflow: { status: "success" } })
        .expect(404);
    });
  });

  describe("GET /v1/dionysus/workflow/stats (GetMetadataWorkflowStatistics)", () => {
    it("returns 30 days of status counts and timings", async () => {
      t.graphql.on("GetMetadataWorkflowStatistics", {
        dionysus_metadata_workflow_statistics: [
          { createdTime: "2026-09-18", queueTime: 12, runTime: 300, count: 1 },
          { createdTime: "2026-01-01", queueTime: 99, runTime: 99, count: 1 },
        ],
        dionysus_metadata_workflow_status_statistics: [
          { createdTime: "2026-09-16", status: "success", count: 3 },
          { createdTime: "2026-09-16", status: "paused", count: 1 },
          { createdTime: "2025-09-16", status: "failed", count: 8 },
        ],
      });

      const res = await t.http().get("/v1/dionysus/workflow/stats");

      expect(res.status).toBe(200);
      const { status, timing } = res.body.series;
      expect(timing.queueTime).toHaveLength(30);
      expect(timing.queueTime[29]).toEqual([TODAY, 12]);
      expect(timing.runtime[29]).toEqual([TODAY, 300]);
      expect(status.success[27]).toEqual([TODAY - 2 * DAY, 3]);
      expect(status.failed.every(([, n]: number[]) => n === 0)).toBe(true);
      expect(status.paused).toBeUndefined();
      expect(res.body.categories.status).toEqual([
        "created",
        "started",
        "success",
        "failed",
        "cancelled",
      ]);
    });
  });
});
