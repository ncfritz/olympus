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
import { aggregate } from "../../fixtures/dionysus";
import {
  DOWNLOAD_ID,
  graphQlMediaWorkflow,
  graphQlMediaWorkflowStep,
  MEDIA_STEP_ID,
  MEDIA_WORKFLOW_ID,
  MOVIE_ID,
  RESULT_ID,
} from "../../fixtures/media";
import { createTestApp, type TestApp } from "../../support/testApp";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const WORKFLOW = `/v1/dionysus/media/workflow/${MEDIA_WORKFLOW_ID}`;
const STEP = `${WORKFLOW}/steps/${MEDIA_STEP_ID}`;

const workflowExists = {
  dionysus_media_asset_workflow_by_pk: {
    id: MEDIA_WORKFLOW_ID,
    type: "movie",
    mediaId: MOVIE_ID,
  },
};
const stepExists = (overrides: Record<string, unknown> = {}) => ({
  dionysus_media_asset_workflow_step_by_pk: {
    id: MEDIA_STEP_ID,
    type: "transcode",
    status: "running",
    assetType: "movie",
    mediaId: MOVIE_ID,
    progress: 50,
    ...overrides,
  },
});
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

describe("Dionysus media workflows API", () => {
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

  describe("POST .../workflow/:resultId/workflow (CreateMediaAssetWorkflow)", () => {
    const url = `/v1/dionysus/media/searchConfiguration/movie/${MOVIE_ID}/workflow/${RESULT_ID}/workflow`;

    it("creates the workflow and download, marks the result and starts the download", async () => {
      t.graphql.on("VerifyMediaAssetSearchResult", {
        dionysus_media_asset_search_result_by_pk: {
          assetType: "movie",
          mediaId: MOVIE_ID,
          id: RESULT_ID,
        },
      });
      t.graphql.on("CreateMediaAssetWorkflow", {
        insert_dionysus_media_asset_download_one: { status: "pending" },
        insert_dionysus_media_asset_workflow_one: graphQlMediaWorkflow({
          status: "queued" as never,
        }),
        update_dionysus_media_asset_search_result_by_pk: {
          status: "download_requested",
        },
      });

      const res = await t.http().post(url);

      expect(res.status).toBe(201);
      expect(res.body.workflow).toMatchObject({
        id: MEDIA_WORKFLOW_ID,
        status: "queued",
      });
      const { variables } = t.graphql.calls("CreateMediaAssetWorkflow")[0];
      expect(variables).toMatchObject({
        assetType: "movie",
        mediaId: MOVIE_ID,
        searchResultId: RESULT_ID,
        workflowStatus: "queued",
        downloadStatus: "pending",
        searchResultStatus: "download_requested",
        startedTime: NOW.toISOString(),
      });
      expect(t.amqp.publish).toHaveBeenCalledWith(
        "download.trigger",
        "download.start",
        {
          mediaType: "movie",
          mediaId: MOVIE_ID,
          resultId: RESULT_ID,
          workflowId: MEDIA_WORKFLOW_ID,
          downloadId: DOWNLOAD_ID,
          nzbId: RESULT_ID,
        },
        { persistent: true, headers: { "x-delay": 10000 } },
      );
    });

    it("returns 404 for an unknown search result", async () => {
      t.graphql.on("VerifyMediaAssetSearchResult", {
        dionysus_media_asset_search_result_by_pk: null,
      });

      await t.http().post(url).expect(404);

      expect(t.amqp.publish).not.toHaveBeenCalled();
    });
  });

  describe("POST /v1/dionysus/media/workflow/:workflowId/steps (CreateMediaAssetWorkflowStep)", () => {
    it("starts a step for the workflow's media", async () => {
      t.graphql.on("GetParentMediaAssetWorkflow", workflowExists);
      t.graphql.on("CreateMediaAssetWorkflowStep", {
        insert_dionysus_media_asset_workflow_step_one:
          graphQlMediaWorkflowStep(),
      });

      const res = await t
        .http()
        .post(`${WORKFLOW}/steps`)
        .send({ step: { type: "transcode" } });

      expect(res.status).toBe(201);
      expect(res.body.step.id).toBe(MEDIA_STEP_ID);
      expect(
        t.graphql.calls("CreateMediaAssetWorkflowStep")[0].variables,
      ).toEqual({
        workflowId: MEDIA_WORKFLOW_ID,
        assetType: "movie",
        mediaId: MOVIE_ID,
        workflowStepType: "transcode",
        workflowStepStatus: "running",
        startedTime: NOW.toISOString(),
        progress: 0,
      });
    });

    it("returns 404 for an unknown workflow", async () => {
      t.graphql.on("GetParentMediaAssetWorkflow", {
        dionysus_media_asset_workflow_by_pk: null,
      });

      await t
        .http()
        .post("/v1/dionysus/media/workflow/missing/steps")
        .send({ step: { type: "transcode" } })
        .expect(404);
    });
  });

  describe("POST .../step/:workflowStepId/subSteps (CreateMediaAssetWorkflowSubStep)", () => {
    it("starts a sub-step under the step", async () => {
      t.graphql.on("GetParentMediaAssetWorkflowStep", stepExists());
      t.graphql.on("CreateMediaAssetWorkflowSubStep", {
        insert_dionysus_media_asset_workflow_step_one: {
          ...graphQlMediaWorkflowStep({ id: "sub-1" }),
          type: "sample_0",
        },
      });

      const res = await t
        .http()
        .post(`${WORKFLOW}/step/${MEDIA_STEP_ID}/subSteps`)
        .send({ step: { type: "sample_0" } });

      expect(res.status).toBe(201);
      expect(res.body.step).toMatchObject({ id: "sub-1", type: "sample_0" });
      expect(
        t.graphql.calls("CreateMediaAssetWorkflowSubStep")[0].variables,
      ).toMatchObject({
        workflowStepId: MEDIA_STEP_ID,
        workflowStepType: "sample_0",
      });
    });

    it("returns 404 for an unknown step", async () => {
      t.graphql.on("GetParentMediaAssetWorkflowStep", {
        dionysus_media_asset_workflow_step_by_pk: null,
      });

      await t
        .http()
        .post(`${WORKFLOW}/step/missing/subSteps`)
        .send({ step: { type: "sample_0" } })
        .expect(404);
    });
  });

  describe("GET /v1/dionysus/media/workflow/:workflowId (DescribeMediaAssetWorkflow)", () => {
    it("returns the workflow with its download and steps", async () => {
      t.graphql.on("DescribeMediaAssetWorkflow", {
        dionysus_media_asset_workflow_by_pk: graphQlMediaWorkflow(),
      });

      const res = await t.http().get(WORKFLOW);

      expect(res.status).toBe(200);
      expect(res.body.workflow).toMatchObject({
        id: MEDIA_WORKFLOW_ID,
        download: { id: DOWNLOAD_ID },
        steps: [{ id: MEDIA_STEP_ID }],
      });
    });

    it("returns 404 for an unknown workflow", async () => {
      t.graphql.on("DescribeMediaAssetWorkflow", {
        dionysus_media_asset_workflow_by_pk: null,
      });

      await t.http().get("/v1/dionysus/media/workflow/missing").expect(404);
    });
  });

  describe("GET /v1/dionysus/media/workflow/:workflowId/step/:workflowStepId (DescribeMediaAssetWorkflowStep)", () => {
    it("returns the step", async () => {
      t.graphql.on("DescribeMediaAssetWorkflowStep", {
        dionysus_media_asset_workflow_step_by_pk: graphQlMediaWorkflowStep(),
      });

      const res = await t.http().get(`${WORKFLOW}/step/${MEDIA_STEP_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.step).toMatchObject({ id: MEDIA_STEP_ID, progress: 25 });
    });

    it("returns 404 for an unknown step", async () => {
      t.graphql.on("DescribeMediaAssetWorkflowStep", {
        dionysus_media_asset_workflow_step_by_pk: null,
      });

      await t.http().get(`${WORKFLOW}/step/missing`).expect(404);
    });
  });

  describe("PUT /v1/dionysus/media/workflow/:workflowId (UpdateMediaAssetWorkflow)", () => {
    it("applies the changes", async () => {
      t.graphql.on("UpdateMediaAssetWorkflow", {
        update_dionysus_media_asset_workflow_by_pk: graphQlMediaWorkflow(),
      });

      await t
        .http()
        .put(WORKFLOW)
        .send({ workflow: { tempLocation: "/tmp/x" } })
        .expect(200);

      expect(t.graphql.calls("UpdateMediaAssetWorkflow")[0].variables).toEqual({
        workflowId: MEDIA_WORKFLOW_ID,
        changes: { tempLocation: "/tmp/x" },
      });
    });

    it("returns 404 for an unknown workflow", async () => {
      t.graphql.on("UpdateMediaAssetWorkflow", {
        update_dionysus_media_asset_workflow_by_pk: null,
      });

      await t
        .http()
        .put("/v1/dionysus/media/workflow/missing")
        .send({ workflow: {} })
        .expect(404);
    });
  });

  describe("PUT .../steps/:workflowStepId (UpdateMediaAssetWorkflowStep)", () => {
    beforeEach(() => {
      t.graphql.on("GetParentMediaAssetWorkflow", workflowExists);
      t.graphql.on("UpdateMediaAssetWorkflowStep", {
        update_dionysus_media_asset_workflow_step_by_pk:
          graphQlMediaWorkflowStep(),
        update_dionysus_media_asset_workflow_by_pk: { id: MEDIA_WORKFLOW_ID },
      });
    });
    const call = () => t.graphql.calls("UpdateMediaAssetWorkflowStep")[0];

    it("records progress that moves forward", async () => {
      t.graphql.on(
        "GetParentMediaAssetWorkflowStep",
        stepExists({ progress: 50 }),
      );

      await t
        .http()
        .put(STEP)
        .send({ step: { progress: 75 } })
        .expect(200);

      expect(call().variables).toEqual({
        id: MEDIA_STEP_ID,
        workflowId: MEDIA_WORKFLOW_ID,
        changes: { progress: 75 },
      });
      expect(call().document).not.toContain(
        "update_dionysus_media_asset_workflow_by_pk",
      );
    });

    it("keeps the stored progress when the update is behind it", async () => {
      t.graphql.on(
        "GetParentMediaAssetWorkflowStep",
        stepExists({ progress: 50 }),
      );

      await t
        .http()
        .put(STEP)
        .send({ step: { progress: 10 } })
        .expect(200);

      expect(call().variables?.changes).toEqual({ progress: 50 });
    });

    it.each([
      ["pending", "pending_input"],
      ["failed", "failed"],
      ["skipped", "running"],
    ])("moves the workflow to %s -> %s", async (stepStatus, workflowStatus) => {
      t.graphql.on("GetParentMediaAssetWorkflowStep", stepExists());

      await t
        .http()
        .put(STEP)
        .send({ step: { status: stepStatus } })
        .expect(200);

      expect(call().variables?.workflowStatus).toBe(workflowStatus);
      expect(call().document).toContain(
        "update_dionysus_media_asset_workflow_by_pk",
      );
    });

    it("finishes the workflow on success when asked", async () => {
      t.graphql.on("GetParentMediaAssetWorkflowStep", stepExists());

      await t
        .http()
        .put(`${STEP}?updateWorkflowStatus=true`)
        .send({ step: { status: "success", progress: 100 } })
        .expect(200);

      expect(call().variables).toMatchObject({
        workflowStatus: "success",
        workflowFinishedTime: NOW.toISOString(),
      });
    });

    it("leaves the workflow alone on step success by default", async () => {
      t.graphql.on("GetParentMediaAssetWorkflowStep", stepExists());

      await t
        .http()
        .put(STEP)
        .send({ step: { status: "success" } })
        .expect(200);

      expect(call().variables?.workflowStatus).toBeUndefined();
    });

    it("returns 404 for an unknown step", async () => {
      t.graphql.on("GetParentMediaAssetWorkflowStep", {
        dionysus_media_asset_workflow_step_by_pk: null,
      });

      await t
        .http()
        .put(STEP)
        .send({ step: { progress: 1 } })
        .expect(404);
    });
  });

  describe("PUT .../approveConfig (ApproveMediaAssetTranscodeConfiguration)", () => {
    const body = {
      videoTrackIndex: 0,
      audioTrackIndex: 1,
      subtitleTrackIndex: 2,
      originalAssetExtension: "mkv",
      verificationRequired: true,
    };

    it("completes the configure step and starts the transcode configuration", async () => {
      t.graphql.on("GetParentMediaAssetWorkflow", workflowExists);
      t.graphql.on(
        "GetParentMediaAssetWorkflowStep",
        stepExists({ type: "configure_transcode" }),
      );
      t.graphql.on("UpdateMediaAssetWorkflowStep", {
        update_dionysus_media_asset_workflow_step_by_pk:
          graphQlMediaWorkflowStep({ type: "configure_transcode" as never }),
      });

      await t.http().put(`${STEP}/approveConfig`).send(body).expect(200);

      const changes = t.graphql.calls("UpdateMediaAssetWorkflowStep")[0]
        .variables?.changes;
      expect(json(changes)).toEqual({
        status: "running",
        progress: 100,
        finishedTime: NOW.toISOString(),
      });
      expect(t.amqp.publish).toHaveBeenCalledWith(
        "media.trigger",
        "jobType.transcodeConfiguration",
        {
          workflowId: MEDIA_WORKFLOW_ID,
          configurationStepId: MEDIA_STEP_ID,
          videoStreamIndex: 0,
          audioStreamIndex: 1,
          subtitleStreamIndex: 2,
          mediaExtension: "mkv",
          transcodeVerificationRequired: true,
        },
        { persistent: true },
      );
    });

    it("returns 400 when the step is not a configure step", async () => {
      t.graphql.on("GetParentMediaAssetWorkflow", workflowExists);
      t.graphql.on("GetParentMediaAssetWorkflowStep", stepExists());

      await t.http().put(`${STEP}/approveConfig`).send(body).expect(400);

      expect(t.amqp.publish).not.toHaveBeenCalled();
    });
  });

  describe("PUT .../verifyConfig (VerifyMediaAssetTranscodeConfiguration)", () => {
    beforeEach(() => {
      t.graphql.on("GetParentMediaAssetWorkflow", workflowExists);
      t.graphql.on("UpdateMediaAssetWorkflowStep", {
        update_dionysus_media_asset_workflow_step_by_pk:
          graphQlMediaWorkflowStep({ type: "verify_transcode" as never }),
      });
    });

    it.each([
      ["running", "success"],
      ["skipped", "skipped"],
    ])(
      "completes a %s verify step as %s and starts the transcode",
      async (current, next) => {
        t.graphql.on(
          "GetParentMediaAssetWorkflowStep",
          stepExists({ type: "verify_transcode", status: current }),
        );

        await t.http().put(`${STEP}/verifyConfig`).expect(200);

        expect(
          t.graphql.calls("UpdateMediaAssetWorkflowStep")[0].variables?.changes,
        ).toMatchObject({ status: next, progress: 100 });
        expect(t.amqp.publish).toHaveBeenCalledWith(
          "media.trigger",
          "jobType.transcode",
          { workflowId: MEDIA_WORKFLOW_ID, configurationStepId: MEDIA_STEP_ID },
          { persistent: true },
        );
      },
    );
  });

  describe("DELETE /v1/dionysus/media/workflow/:workflowId (DeleteMediaAssetWorkflow)", () => {
    it("soft deletes and asks the agents to clean up", async () => {
      t.graphql.on("SoftDeleteMediaAssetWorkflow", {
        update_dionysus_media_asset_workflow_by_pk: { id: MEDIA_WORKFLOW_ID },
      });

      await t.http().delete(WORKFLOW).expect(200);

      expect(
        t.graphql.calls("SoftDeleteMediaAssetWorkflow")[0].variables,
      ).toEqual({
        workflowId: MEDIA_WORKFLOW_ID,
        deletionTime: NOW.toISOString(),
      });
      expect(t.amqp.publish).toHaveBeenCalledWith(
        "media.trigger",
        "jobType.deleteWorkflow",
        { workflowId: MEDIA_WORKFLOW_ID },
      );
    });

    it("hard deletes the workflow, its steps and download", async () => {
      t.graphql.on("HardDeleteMediaAssetWorkflow", {
        delete_dionysus_media_asset_workflow_step: { affected_rows: 3 },
        delete_dionysus_media_asset_download: { affected_rows: 1 },
        delete_dionysus_media_asset_workflow_by_pk: { id: MEDIA_WORKFLOW_ID },
      });

      await t.http().delete(`${WORKFLOW}?hardDelete=true`).expect(204);

      expect(t.amqp.publish).not.toHaveBeenCalled();
    });

    it.each([
      [
        "SoftDeleteMediaAssetWorkflow",
        "",
        { update_dionysus_media_asset_workflow_by_pk: null },
      ],
      [
        "HardDeleteMediaAssetWorkflow",
        "?hardDelete=true",
        {
          delete_dionysus_media_asset_workflow_step: { affected_rows: 0 },
          delete_dionysus_media_asset_download: { affected_rows: 0 },
          delete_dionysus_media_asset_workflow_by_pk: null,
        },
      ],
    ])(
      "%s returns 404 for an unknown workflow",
      async (operation, query, row) => {
        t.graphql.on(operation, row);

        await t
          .http()
          .delete(`/v1/dionysus/media/workflow/missing${query}`)
          .expect(404);

        expect(t.amqp.publish).not.toHaveBeenCalled();
      },
    );
  });

  describe("GET /v1/dionysus/media/workflows (ListMediaAssetWorkflows)", () => {
    it("returns a page of workflows", async () => {
      t.graphql.on("ListMediaAssetWorkflows", {
        dionysus_media_asset_workflow: [graphQlMediaWorkflow()],
        dionysus_media_asset_workflow_aggregate: aggregate(2),
      });

      const res = await t.http().get("/v1/dionysus/media/workflows");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.workflows[0].decoration.name).toBe("The Matrix");
      expect(t.graphql.calls("ListMediaAssetWorkflows")[0].document).toContain(
        "limit: 24, offset: 0, order_by: [{createdTime: desc}]",
      );
    });
  });
});
