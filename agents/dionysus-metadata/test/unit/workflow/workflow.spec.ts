import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  JobApi,
  NotificationApi,
  MetadataWorkflowApi,
} from "@ncfritz/olympus-client";
import type { BatchJobCompletionMessage } from "../../../src/messaging";
import { StartWorkflowHandler } from "../../../src/workflow/handlers/StartWorkflowHandler";
import { WorkflowJobCompletionHandler } from "../../../src/workflow/handlers/WorkflowJobCompletionHandler";
import { ExecutionRegistry } from "../../../src/workflow/services/ExecutionRegistry";
import { JobNotifier } from "../../../src/workflow/services/JobNotifier";
import {
  fakeJobApi,
  fakeNotifier,
  fakeWorkflowApi,
} from "../../fixtures/fakes";

describe("workflows", () => {
  let workflowApi: ReturnType<typeof fakeWorkflowApi>;
  let jobApi: ReturnType<typeof fakeJobApi>;
  let notifier: ReturnType<typeof fakeNotifier>;
  let executions: ExecutionRegistry;
  let completion: WorkflowJobCompletionHandler;

  const done = (
    overrides: Partial<BatchJobCompletionMessage> = {},
  ): BatchJobCompletionMessage => ({
    jobId: "job-1",
    jobType: "languages",
    status: "success",
    workflowId: "wf-1",
    stepId: "step-1",
    attempt: 0,
    recordsProcessed: 100,
    ...overrides,
  });

  beforeEach(() => {
    workflowApi = fakeWorkflowApi();
    jobApi = fakeJobApi();
    notifier = fakeNotifier();
    executions = new ExecutionRegistry(
      workflowApi as unknown as MetadataWorkflowApi,
      jobApi as unknown as JobApi,
      notifier as unknown as JobNotifier,
    );
    completion = new WorkflowJobCompletionHandler(
      workflowApi as unknown as MetadataWorkflowApi,
      jobApi as unknown as JobApi,
      executions,
      notifier as unknown as JobNotifier,
    );
  });

  it("starts with languages", async () => {
    await new StartWorkflowHandler(
      workflowApi as unknown as MetadataWorkflowApi,
      executions,
    ).handle({ workflowId: "wf-1" });

    expect(workflowApi.updateMetadataWorkflow).toHaveBeenCalledWith("wf-1", {
      status: "started",
      startedTime: expect.any(String),
    });
    expect(workflowApi.createMetadataWorkflowStep).toHaveBeenCalledWith(
      "wf-1",
      {
        type: "job_execution",
        jobType: "languages",
        attempt: 0,
        offset: 0,
      },
    );
    expect(executions.getExecutions()).toEqual([
      { id: "wf-1", type: "workflow" },
    ]);
  });

  it("runs the job types in order", async () => {
    const order = [
      "languages",
      "countries",
      "certifications",
      "genres",
      "production_companies",
      "keywords",
      "tv_networks",
      "collections",
      "people",
      "tv_series",
      "movies",
    ] as const;
    for (const jobType of order.slice(0, -1)) {
      await completion.handle(done({ jobType }));
    }
    expect(
      workflowApi.createMetadataWorkflowStep.mock.calls.map(
        (call) => (call as unknown as [string, { jobType: string }])[1].jobType,
      ),
    ).toEqual(order.slice(1));
  });

  it("succeeds after movies", async () => {
    executions.add({ id: "wf-1", type: "workflow" });
    await completion.handle(done({ jobType: "movies" }));
    expect(workflowApi.updateMetadataWorkflow).toHaveBeenCalledWith("wf-1", {
      status: "success",
      finishedTime: expect.any(String),
    });
    expect(notifier.sendWorkflowNotification).toHaveBeenCalledWith(
      "wf-1",
      "success",
    );
    expect(executions.getExecutions()).toEqual([]);
  });

  it("retries a failed job from where it stopped", async () => {
    await completion.handle(done({ status: "failed", attempt: 1 }));
    expect(jobApi.updateBatchJob).toHaveBeenCalledWith("job-1", {
      status: "cancelled",
      finishedTime: expect.any(String),
    });
    expect(workflowApi.createMetadataWorkflowStep).toHaveBeenCalledWith(
      "wf-1",
      {
        type: "retry",
        jobType: "languages",
        attempt: 2,
        offset: 100,
      },
    );
  });

  it("fails the workflow after the third attempt", async () => {
    await completion.handle(done({ status: "failed", attempt: 3 }));
    expect(workflowApi.updateMetadataWorkflow).toHaveBeenCalledWith("wf-1", {
      status: "failed",
      finishedTime: expect.any(String),
    });
    expect(workflowApi.createMetadataWorkflowStep).not.toHaveBeenCalled();
    expect(notifier.sendWorkflowNotification).toHaveBeenCalledWith(
      "wf-1",
      "failed",
    );
  });

  it("fails the workflow when a job is cancelled", async () => {
    await completion.handle(done({ status: "cancelled" }));
    expect(notifier.sendWorkflowNotification).toHaveBeenCalledWith(
      "wf-1",
      "failed",
    );
  });

  it("ignores completions outside a workflow", async () => {
    await completion.handle(done({ workflowId: undefined }));
    expect(workflowApi.updateMetadataWorkflow).not.toHaveBeenCalled();
  });

  it("fails what is still running at shutdown", async () => {
    executions.add({ id: "wf-1", type: "workflow" });
    executions.add({ id: "job-1", type: "batch" });
    await executions.failOutstanding();
    expect(workflowApi.updateMetadataWorkflow).toHaveBeenCalledWith("wf-1", {
      status: "failed",
    });
    expect(jobApi.updateBatchJob).toHaveBeenCalledWith("job-1", {
      status: "failed",
    });
  });
});

describe("JobNotifier", () => {
  const api = { sendNotification: vi.fn(async () => ({})) };
  const notifier = new JobNotifier(api as unknown as NotificationApi);
  beforeEach(() => api.sendNotification.mockClear());

  it("notifies finished workflows, by site and email", async () => {
    await notifier.sendWorkflowNotification("wf-1", "failed");
    expect(api.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "dionysus_metadata_workflow_completion",
        webSocketDestination: expect.objectContaining({ level: "error" }),
        synoMailDestination: expect.anything(),
        smtpDestination: expect.anything(),
        context: { workflowId: "wf-1", status: "failed" },
      }),
    );
  });

  it("ignores workflows still running", async () => {
    await notifier.sendWorkflowNotification("wf-1", "started");
    expect(api.sendNotification).not.toHaveBeenCalled();
  });

  it("notifies batch jobs outside workflows only", async () => {
    const job = { id: "job-1", type: "movies", status: "success" };
    await notifier.sendBatchJobNotification(job as never, "wf-1");
    expect(api.sendNotification).not.toHaveBeenCalled();
    await notifier.sendBatchJobNotification(job as never);
    expect(api.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "dionysus_batch_job_complete",
        webSocketDestination: expect.objectContaining({ level: "success" }),
      }),
    );
  });

  it("doesn't throw when the notification fails", async () => {
    api.sendNotification.mockRejectedValueOnce(new Error("down"));
    await expect(
      notifier.sendWorkflowNotification("wf-1", "success"),
    ).resolves.toBeUndefined();
  });
});
