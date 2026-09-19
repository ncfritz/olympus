import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import moment from "moment";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchJobApi } from "../../../src/api/BatchJobApi";
import type { MetadataApi } from "../../../src/api/MetadataApi";
import { BatchHandler } from "../../../src/batch/handlers/BatchHandler";
import { ListSource } from "../../../src/batch/sources/ListSource";
import type { FetchJobs } from "../../../src/fetchJobs/FetchJobs";
import type { BatchJobMessage } from "../../../src/messaging";
import type { TmdbClient } from "../../../src/tmdb/services/TmdbClient";
import type { ExecutionRegistry } from "../../../src/workflow/services/ExecutionRegistry";
import type { JobNotifier } from "../../../src/workflow/services/JobNotifier";
import {
  fakeAmqp,
  fakeBatchJobApi,
  fakeFetchJobs,
  fakeNotifier,
  fakeStore,
  type FakeStore,
  fetchJob,
  PAST,
} from "../../fixtures/fakes";

type Row = { id: number };

/** A batch job over a fixed list. */
class TestBatchHandler extends BatchHandler<Row> {
  rows: Row[] = [];

  protected createSource() {
    return new ListSource(async () => this.rows);
  }

  handle(message: BatchJobMessage) {
    return this.run(message);
  }
}

const message = (
  overrides: Partial<BatchJobMessage> = {},
): BatchJobMessage => ({
  jobId: "job-1",
  jobType: "movies",
  offset: 0,
  ...overrides,
});

describe("BatchHandler", () => {
  let store: FakeStore;
  let batchJobApi: ReturnType<typeof fakeBatchJobApi>;
  let amqp: ReturnType<typeof fakeAmqp>;
  let notifier: ReturnType<typeof fakeNotifier>;
  let executions: {
    add: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let handler: TestBatchHandler;

  /** The job as last saved. */
  const savedJob = () =>
    batchJobApi.updateBatchJob.mock.lastCall![1] as Record<string, unknown>;

  const build = () => {
    handler = new TestBatchHandler(
      amqp as unknown as AmqpConnection,
      batchJobApi as unknown as BatchJobApi,
      {} as MetadataApi,
      {} as TmdbClient,
      fakeFetchJobs(store) as unknown as FetchJobs,
      executions as unknown as ExecutionRegistry,
      notifier as unknown as JobNotifier,
    );
  };

  beforeEach(() => {
    store = fakeStore();
    batchJobApi = fakeBatchJobApi();
    amqp = fakeAmqp();
    notifier = fakeNotifier();
    executions = { add: vi.fn(), remove: vi.fn() };
    build();
  });

  it("queues a fetch job for each new record", async () => {
    handler.rows = [{ id: 1 }, { id: 2 }];
    await handler.handle(message());

    expect(store.createMetadataFetchJob.mock.calls).toEqual([
      ["1", "movies", 30, expect.any(Number), "queued", true],
      ["2", "movies", 30, expect.any(Number), "queued", true],
    ]);
    expect(savedJob()).toMatchObject({
      status: "success",
      totalRecords: 2,
      processedRecords: 2,
      newRecords: 2,
      finishedTime: expect.any(String),
    });
    expect(executions.add).toHaveBeenCalledWith({ id: "job-1", type: "batch" });
    expect(executions.remove).toHaveBeenCalledWith("job-1");
    expect(notifier.sendBatchJobNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: "job-1", status: "success" }),
      undefined,
    );
  });

  it("invalidates expired fetch jobs and leaves fresh ones", async () => {
    store = fakeStore([
      fetchJob({ id: "1", status: "fetched", lastFetchedTime: PAST }),
      fetchJob({
        id: "2",
        status: "fetched",
        lastFetchedTime: moment.utc().toISOString(),
      }),
      fetchJob({ id: "3", status: "invalidated", lastFetchedTime: PAST }),
    ]);
    build();
    handler.rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    await handler.handle(message());

    expect(
      store.updateMetadataFetchJob.mock.calls.map((call) => call.slice(0, 5)),
    ).toEqual([
      ["1", "movies", { status: "invalidated" }, true, false],
      // An invalidated job is queued, with a fresh TTL and jitter.
      [
        "3",
        "movies",
        { status: "queued", ttl: 30, jitter: expect.any(Number) },
        true,
        false,
      ],
    ]);
    expect(savedJob()).toMatchObject({ expiredRecords: 2, noOpRecords: 1 });
  });

  it("counts never-fetched finished jobs as duplicates", async () => {
    store = fakeStore([fetchJob({ id: "1", status: "failed" })]);
    build();
    handler.rows = [{ id: 1 }];
    await handler.handle(message());
    expect(savedJob()).toMatchObject({ duplicateRecords: 1 });
    expect(store.updateMetadataFetchJob).not.toHaveBeenCalled();
  });

  it("skips `offset` records (a retry resumes where it stopped)", async () => {
    handler.rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    await handler.handle(message({ offset: 2 }));
    expect(store.createMetadataFetchJob.mock.calls.map((c) => c[0])).toEqual([
      "3",
    ]);
    expect(savedJob()).toMatchObject({
      skippedRecords: 2,
      processedRecords: 3,
    });
  });

  it.fails("processes at most `max` records", async () => {
    handler.rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    await handler.handle(message({ max: 2 }));
    expect(store.createMetadataFetchJob).toHaveBeenCalledTimes(2);
  });

  it("ignores jobs that aren't new", async () => {
    batchJobApi.getBatchJob.mockResolvedValue({
      id: "job-1",
      type: "movies",
      status: "started",
    });
    handler.rows = [{ id: 1 }];
    await handler.handle(message());
    expect(store.createMetadataFetchJob).not.toHaveBeenCalled();
    expect(batchJobApi.updateBatchJob).not.toHaveBeenCalled();
  });

  it("fails the job, keeping its counts, when a record fails", async () => {
    store.createMetadataFetchJob.mockRejectedValueOnce(new Error("API down"));
    handler.rows = [{ id: 1 }];
    await handler.handle(message());
    expect(savedJob()).toMatchObject({ status: "failed", processedRecords: 0 });
    expect(executions.remove).toHaveBeenCalledWith("job-1");
  });

  it("reports completion to the job's workflow", async () => {
    handler.rows = [{ id: 1 }];
    await handler.handle(
      message({ workflowId: "wf-1", stepId: "step-1", attempt: 1 }),
    );
    expect(amqp.publish).toHaveBeenCalledWith(
      "batchJob.workflow",
      "jobCompletion",
      {
        jobId: "job-1",
        jobType: "movies",
        status: "success",
        workflowId: "wf-1",
        stepId: "step-1",
        attempt: 1,
        recordsProcessed: 1,
      },
      { persistent: true, headers: { "x-delay": 10000 } },
    );
    expect(notifier.sendBatchJobNotification).toHaveBeenCalledWith(
      expect.anything(),
      "wf-1",
    );
  });
});
