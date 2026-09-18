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
  graphQlBatchJob,
  graphQlMetadataFetchJob,
} from "../../fixtures/dionysus";
import { base64Json } from "../../fixtures/olympus";
import { createTestApp, type TestApp } from "../../support/testApp";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const TODAY = Date.parse("2026-09-18T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("Dionysus jobs API", () => {
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

  describe("batch jobs", () => {
    describe("POST /v1/dionysus/jobs/batch (CreateBatchJob)", () => {
      beforeEach(() => {
        t.graphql.on("CreateBatchJob", {
          insert_dionysus_bulk_load_jobs_one: graphQlBatchJob(),
        });
      });

      it("creates the job, publishes it by default and returns 201", async () => {
        const res = await t
          .http()
          .post("/v1/dionysus/jobs/batch")
          .send({ type: "movies", offset: 10, maxRecordsToProcess: 50 });

        expect(res.status).toBe(201);
        expect(res.body.job).toMatchObject({
          id: BATCH_JOB_ID,
          type: "movies",
          status: "created",
        });
        expect(t.graphql.calls("CreateBatchJob")[0].variables).toEqual({
          type: "movies",
        });
        expect(t.amqp.publish).toHaveBeenCalledWith(
          "batchJob.trigger",
          "jobType.movies",
          { jobType: "movies", jobId: BATCH_JOB_ID, offset: 10, max: 50 },
        );
      });

      it("does not publish when publishNotification is false", async () => {
        await t
          .http()
          .post("/v1/dionysus/jobs/batch")
          .send({ type: "movies", publishNotification: false })
          .expect(201);

        expect(t.amqp.publish).not.toHaveBeenCalled();
      });
    });

    describe("POST /v1/dionysus/jobs/batch/redrive (CreateRedriveJob)", () => {
      it("creates a redrive job and always publishes it", async () => {
        t.graphql.on("CreateBatchJob", {
          insert_dionysus_bulk_load_jobs_one: graphQlBatchJob({
            type: "redrive" as never,
          }),
        });

        await t
          .http()
          .post("/v1/dionysus/jobs/batch/redrive")
          .send({
            metadataType: "people",
            status: "failed",
            targetStatus: "queued",
          })
          .expect(201);

        expect(t.graphql.calls("CreateBatchJob")[0].variables).toEqual({
          type: "redrive",
        });
        expect(t.amqp.publish).toHaveBeenCalledWith(
          "batchJob.trigger",
          "jobType.redrive",
          {
            jobId: BATCH_JOB_ID,
            jobType: "people",
            status: "failed",
            targetStatus: "queued",
            republish: true,
            offset: 0,
          },
        );
      });
    });

    describe("GET /v1/dionysus/job/batch/:jobId (DescribeBatchJob)", () => {
      it("returns the job", async () => {
        t.graphql.on("FetchBatchJob", {
          dionysus_bulk_load_jobs_by_pk: graphQlBatchJob(),
        });

        const res = await t
          .http()
          .get(`/v1/dionysus/job/batch/${BATCH_JOB_ID}`);

        expect(res.status).toBe(200);
        expect(res.body.job).toMatchObject({
          id: BATCH_JOB_ID,
          totalRecords: 100,
          createdTime: "2026-09-18T10:00:00.000Z",
        });
        expect(res.body.job.finishedTime).toBeUndefined();
      });

      it("returns 404 for an unknown job", async () => {
        t.graphql.on("FetchBatchJob", { dionysus_bulk_load_jobs_by_pk: null });

        await t.http().get("/v1/dionysus/job/batch/missing").expect(404);
      });
    });

    describe("PUT /v1/dionysus/job/batch/:jobId (UpdateBatchJob)", () => {
      it("stamps finishedTime when the job reaches a final status", async () => {
        t.graphql.on("UpdateBatchJob", {
          update_dionysus_bulk_load_jobs_by_pk: graphQlBatchJob({
            status: "success" as never,
          }),
        });

        const res = await t
          .http()
          .put(`/v1/dionysus/job/batch/${BATCH_JOB_ID}`)
          .send({ job: { status: "success", processedRecords: 100 } });

        expect(res.status).toBe(200);
        expect(res.body.job.status).toBe("success");
        const { variables } = t.graphql.calls("UpdateBatchJob")[0];
        const changes = variables?.changes as Record<string, unknown>;
        expect(variables?.id).toBe(BATCH_JOB_ID);
        expect(changes.processedRecords).toBe(100);
        expect(JSON.parse(JSON.stringify(changes.finishedTime))).toBe(
          NOW.toISOString(),
        );
      });

      it("leaves finishedTime alone while the job runs", async () => {
        t.graphql.on("UpdateBatchJob", {
          update_dionysus_bulk_load_jobs_by_pk: graphQlBatchJob(),
        });

        await t
          .http()
          .put(`/v1/dionysus/job/batch/${BATCH_JOB_ID}`)
          .send({ job: { status: "started" } })
          .expect(200);

        expect(t.graphql.calls("UpdateBatchJob")[0].variables?.changes).toEqual(
          { status: "started" },
        );
      });

      it("returns 404 for an unknown job", async () => {
        t.graphql.on("UpdateBatchJob", {
          update_dionysus_bulk_load_jobs_by_pk: null,
        });

        await t
          .http()
          .put("/v1/dionysus/job/batch/missing")
          .send({ job: { status: "started" } })
          .expect(404);
      });
    });

    describe("DELETE /v1/dionysus/job/batch/:jobId (DeleteBatchJob)", () => {
      it("deletes the job and returns 204", async () => {
        t.graphql.on("DeleteBatchJob", {
          delete_dionysus_bulk_load_jobs_by_pk: { id: BATCH_JOB_ID },
        });

        await t
          .http()
          .delete(`/v1/dionysus/job/batch/${BATCH_JOB_ID}`)
          .expect(204);

        expect(t.graphql.calls("DeleteBatchJob")[0].variables).toEqual({
          id: BATCH_JOB_ID,
        });
      });

      it("returns 404 for an unknown job", async () => {
        t.graphql.on("DeleteBatchJob", {
          delete_dionysus_bulk_load_jobs_by_pk: null,
        });

        await t.http().delete("/v1/dionysus/job/batch/missing").expect(404);
      });
    });

    describe("GET /v1/dionysus/jobs/batch (ListBatchJobs)", () => {
      beforeEach(() => {
        t.graphql.on("ListBatchJobs", {
          dionysus_bulk_load_jobs: [graphQlBatchJob()],
          dionysus_bulk_load_jobs_aggregate: aggregate(41),
        });
      });
      const document = () => t.graphql.calls("ListBatchJobs")[0].document;

      it("returns a page of jobs and the total", async () => {
        const res = await t.http().get("/v1/dionysus/jobs/batch");

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(41);
        expect(res.body.jobs).toHaveLength(1);
        expect(document()).toContain(
          "limit: 100, offset: 0, order_by: [{createdTime: desc}]",
        );
      });

      it("applies filters to the page and the count", async () => {
        const filters = base64Json({
          type: "eq",
          name: "status",
          value: "failed",
        });

        await t
          .http()
          .get("/v1/dionysus/jobs/batch")
          .query({ filters, pageSize: 20, startPage: 1 })
          .expect(200);

        expect(document()).toContain("limit: 20, offset: 20");
        expect(document()).toContain(
          'dionysus_bulk_load_jobs_aggregate(where: {status: {_eq: "failed"}})',
        );
      });

      it.each([
        ["sortBy", "createdTime: asc}]) { id } x: foo(order_by: [{id"],
        ["pageSize", "ten"],
        ["filters", "not-base64-json"],
      ])("rejects an invalid %s", async (param, value) => {
        await t
          .http()
          .get("/v1/dionysus/jobs/batch")
          .query({ [param]: value })
          .expect(400);

        expect(t.graphql.calls("ListBatchJobs")).toHaveLength(0);
      });
    });

    describe("GET /v1/dionysus/jobs/batch/:jobType (ListBatchJobsByType)", () => {
      beforeEach(() => {
        t.graphql.on("ListBatchJobsByType", {
          dionysus_bulk_load_jobs: [graphQlBatchJob()],
          dionysus_bulk_load_jobs_aggregate: aggregate(3),
        });
      });
      const document = () => t.graphql.calls("ListBatchJobsByType")[0].document;

      it("lists only jobs of the type", async () => {
        const res = await t.http().get("/v1/dionysus/jobs/batch/movies");

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(3);
        expect(document()).toContain('where: {type: {_eq: "movies"}}');
      });

      it("combines the type with the caller's filters", async () => {
        const filters = base64Json({
          type: "eq",
          name: "status",
          value: "failed",
        });

        await t
          .http()
          .get("/v1/dionysus/jobs/batch/movies")
          .query({ filters })
          .expect(200);

        expect(document()).toContain(
          'where: {_and: [{type: {_eq: "movies"}}, {status: {_eq: "failed"}}]}',
        );
      });

      it("escapes the job type", async () => {
        await t
          .http()
          .get(`/v1/dionysus/jobs/batch/${encodeURIComponent('x"} } }')}`)
          .expect(200);

        expect(document()).toContain('{type: {_eq: "x\\"} } }"}}');
      });
    });

    describe("GET /v1/dionysus/jobs/batch/stats (GetBatchJobStats)", () => {
      it("returns status counts per type and 30 days of timings", async () => {
        t.graphql.on("GetBatchJobStatistics", {
          dionysus_bulk_load_jobs_status_statistics: [
            { type: "movies", status: "success", count: 7 },
            { type: "people", status: "failed", count: 2 },
            { type: "unknown", status: "failed", count: 99 },
          ],
          dionysus_bulk_load_jobs_statistics: [
            {
              type: "movies",
              created_date: "2026-09-18",
              queue_time: 5,
              run_time: 60,
            },
            {
              type: "movies",
              created_date: "2026-08-20",
              queue_time: 3,
              run_time: 30,
            },
            {
              type: "movies",
              created_date: "2026-07-01",
              queue_time: 1,
              run_time: 1,
            },
          ],
        });

        const res = await t.http().get("/v1/dionysus/jobs/batch/stats");

        expect(res.status).toBe(200);
        expect(t.graphql.calls("GetBatchJobStatistics")[0].variables).toEqual({
          lastMonth: "2026-08-19T00:00:00.000Z",
        });
        const { status, timing } = res.body.series;
        expect(res.body.categories.status[0]).toBe("Movies");
        expect(status.success[0]).toBe(7);
        expect(status.failed[4]).toBe(2);
        expect(status.failed.reduce((a: number, b: number) => a + b)).toBe(2);

        const movies = timing.queueTime.movies;
        expect(movies).toHaveLength(30);
        expect(movies[29]).toEqual([TODAY, 5]);
        expect(movies[0]).toEqual([TODAY - 29 * DAY, 3]);
        expect(timing.runtime.movies[29]).toEqual([TODAY, 60]);
        expect(timing.queueTime.people[29]).toEqual([TODAY, 0]);
      });
    });

    describe("GET /v1/dionysus/jobs/batch/:jobType/stats (GetBatchJobStatsByType)", () => {
      it("returns 30 days of record counts and timings for the type", async () => {
        t.graphql.on("GetBatchJobStatisticsByType", {
          dionysus_bulk_load_jobs_statistics: [
            {
              type: "movies",
              created_date: "2026-09-17",
              queue_time: 4,
              run_time: 40,
              total_records: 10,
              new_records: 3,
              expired_records: 2,
              noop_records: 1,
              skipped_records: 1,
              processed_records: 9,
            },
            { type: "movies", created_date: "2025-01-01", total_records: 500 },
          ],
        });

        const res = await t.http().get("/v1/dionysus/jobs/batch/movies/stats");

        expect(res.status).toBe(200);
        expect(
          t.graphql.calls("GetBatchJobStatisticsByType")[0].variables,
        ).toEqual({ type: "movies" });
        const { records, timing } = res.body.series;
        const yesterday = TODAY - DAY;
        expect(records.total).toHaveLength(30);
        expect(records.total[28]).toEqual([yesterday, 10]);
        expect(records.processed[28]).toEqual([yesterday, 9]);
        expect(records.total[29]).toEqual([TODAY, 0]);
        expect(timing.queueTime[28]).toEqual([yesterday, 4]);
        expect(timing.runtime[28]).toEqual([yesterday, 40]);
      });
    });
  });

  describe("metadata fetch jobs", () => {
    describe("POST /v1/dionysus/metadata/fetchJobs (CreateMetadataFetchJob)", () => {
      beforeEach(() => {
        t.graphql.on("CreateMetadataFetchJob", {
          insert_dionysus_metadata_fetch_status_one: graphQlMetadataFetchJob(),
        });
      });

      it("upserts the job, publishes a delayed fetch and returns 201", async () => {
        const res = await t
          .http()
          .post("/v1/dionysus/metadata/fetchJobs")
          .send({
            id: "603",
            type: "movies",
            ttl: 14,
            jitter: 60,
            bypassCache: true,
            context: { source: "tmdb" },
          });

        expect(res.status).toBe(201);
        expect(res.body.job).toMatchObject({
          id: "603",
          type: "movies",
          context: { source: "tmdb" },
        });
        expect(t.graphql.calls("CreateMetadataFetchJob")[0].variables).toEqual({
          id: "603",
          type: "movies",
          status: "queued",
          lastFetchedTime: undefined,
          ttl: 14,
          jitter: 60,
          context: base64Json({ source: "tmdb" }),
        });
        expect(t.amqp.publish).toHaveBeenCalledWith(
          "metadataJob.trigger",
          "jobType.movies",
          { entityId: "603", entityType: "movies", bypassCache: true },
          { persistent: true, headers: { "x-delay": 10000 } },
        );
      });

      it("keeps an explicit ttl and jitter of zero", async () => {
        await t
          .http()
          .post("/v1/dionysus/metadata/fetchJobs")
          .send({ id: "603", type: "movies", ttl: 0, jitter: 0 })
          .expect(201);

        expect(
          t.graphql.calls("CreateMetadataFetchJob")[0].variables,
        ).toMatchObject({ ttl: 0, jitter: 0 });
      });

      it("defaults the ttl to 30 days and jitters up to 3 days", async () => {
        await t
          .http()
          .post("/v1/dionysus/metadata/fetchJobs")
          .send({ id: "603", type: "movies", publishNotification: false })
          .expect(201);

        const variables = t.graphql.calls("CreateMetadataFetchJob")[0]
          .variables as { ttl: number; jitter: number };
        expect(variables.ttl).toBe(30);
        expect(variables.jitter).toBeGreaterThanOrEqual(0);
        expect(variables.jitter).toBeLessThan(3 * 24 * 60);
        expect(t.amqp.publish).not.toHaveBeenCalled();
      });
    });

    describe("GET /v1/dionysus/metadata/fetchJob/:entityId/:entityType (DescribeMetadataFetchJob)", () => {
      it("returns the job", async () => {
        t.graphql.on("FetchMetadataFetchJob", {
          dionysus_metadata_fetch_status_by_pk: graphQlMetadataFetchJob(),
        });

        const res = await t
          .http()
          .get("/v1/dionysus/metadata/fetchJob/603/movies");

        expect(res.status).toBe(200);
        expect(res.body.job).toMatchObject({ id: "603", ttl: 30, jitter: 120 });
        expect(t.graphql.calls("FetchMetadataFetchJob")[0].variables).toEqual({
          id: "603",
          type: "movies",
        });
      });

      it("returns 404 for an unknown job", async () => {
        t.graphql.on("FetchMetadataFetchJob", {
          dionysus_metadata_fetch_status_by_pk: null,
        });

        await t
          .http()
          .get("/v1/dionysus/metadata/fetchJob/1/movies")
          .expect(404);
      });
    });

    describe("PUT /v1/dionysus/metadata/fetchJob/:entityId/:entityType (UpdateMetadataFetchJob)", () => {
      it("updates the job and publishes a fetch when it is queued", async () => {
        t.graphql.on("UpdateMetadataFetchJob", {
          update_dionysus_metadata_fetch_status_by_pk:
            graphQlMetadataFetchJob(),
        });

        const res = await t
          .http()
          .put("/v1/dionysus/metadata/fetchJob/603/movies")
          .send({ job: { status: "queued" } });

        expect(res.status).toBe(200);
        expect(t.graphql.calls("UpdateMetadataFetchJob")[0].variables).toEqual({
          id: "603",
          type: "movies",
          changes: { status: "queued" },
        });
        expect(t.amqp.publish).toHaveBeenCalledWith(
          "metadataJob.trigger",
          "jobType.movies",
          { entityId: "603", entityType: "movies", bypassCache: undefined },
          expect.anything(),
        );
      });

      it.each([
        ["the job is not queued", "fetched", undefined],
        ["publishNotification is false", "queued", false],
      ])("does not publish when %s", async (_, status, publishNotification) => {
        t.graphql.on("UpdateMetadataFetchJob", {
          update_dionysus_metadata_fetch_status_by_pk: graphQlMetadataFetchJob({
            status: status as never,
          }),
        });

        await t
          .http()
          .put("/v1/dionysus/metadata/fetchJob/603/movies")
          .send({ job: { status }, publishNotification })
          .expect(200);

        expect(t.amqp.publish).not.toHaveBeenCalled();
      });

      it("returns 404 for an unknown job", async () => {
        t.graphql.on("UpdateMetadataFetchJob", {
          update_dionysus_metadata_fetch_status_by_pk: null,
        });

        await t
          .http()
          .put("/v1/dionysus/metadata/fetchJob/1/movies")
          .send({ job: { status: "queued" } })
          .expect(404);

        expect(t.amqp.publish).not.toHaveBeenCalled();
      });
    });

    describe("DELETE /v1/dionysus/metadata/fetchJob/:entityId/:entityType (DeleteMetadataFetchJob)", () => {
      it("deletes the job and returns 204", async () => {
        t.graphql.on("DeleteFetchJob", {
          delete_dionysus_metadata_fetch_status_by_pk:
            graphQlMetadataFetchJob(),
        });

        await t
          .http()
          .delete("/v1/dionysus/metadata/fetchJob/603/movies")
          .expect(204);
      });

      it("returns 404 for an unknown job", async () => {
        t.graphql.on("DeleteFetchJob", {
          delete_dionysus_metadata_fetch_status_by_pk: null,
        });

        await t
          .http()
          .delete("/v1/dionysus/metadata/fetchJob/1/movies")
          .expect(404);
      });
    });

    describe("GET /v1/dionysus/jobs/metadata (ListMetadataFetchJobs)", () => {
      it("returns a page of jobs and the total", async () => {
        t.graphql.on("ListMetadataFetchJobs", {
          dionysus_metadata_fetch_status: [graphQlMetadataFetchJob()],
          dionysus_metadata_fetch_status_aggregate: aggregate(9),
        });

        const res = await t
          .http()
          .get("/v1/dionysus/jobs/metadata?sortBy=lastFetchedTime&sort=asc");

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(9);
        expect(res.body.jobs[0].id).toBe("603");
        expect(t.graphql.calls("ListMetadataFetchJobs")[0].document).toContain(
          "limit: 100, offset: 0, order_by: [{lastFetchedTime: asc}]",
        );
      });

      it("rejects an invalid sort direction", async () => {
        await t.http().get("/v1/dionysus/jobs/metadata?sort=up").expect(400);
      });
    });

    describe("GET /v1/dionysus/jobs/metadata/scroll (ScrollMetadataFetchJobs)", () => {
      beforeEach(() => {
        t.graphql.on("ScrollMetadataFetchJobs", {
          dionysus_metadata_fetch_status: [graphQlMetadataFetchJob()],
          dionysus_metadata_fetch_status_aggregate: aggregate(250),
        });
      });
      const variables = () =>
        t.graphql.calls("ScrollMetadataFetchJobs")[0].variables;

      it("returns the first page in ID order", async () => {
        const res = await t.http().get("/v1/dionysus/jobs/metadata/scroll");

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(250);
        expect(variables()).toEqual({ limit: 100, where: { _and: [] } });
      });

      it("continues after lastSeenId with the given filters", async () => {
        await t
          .http()
          .get("/v1/dionysus/jobs/metadata/scroll")
          .query({
            lastSeenId: '603"}',
            pageSize: 25,
            filters: base64Json({ status: ["queued", "failed"], type: [] }),
          })
          .expect(200);

        expect(variables()).toEqual({
          limit: 25,
          where: {
            _and: [
              { id: { _gt: '603"}' } },
              { status: { _in: ["queued", "failed"] } },
            ],
          },
        });
      });

      it.each([
        ["pageSize", "lots"],
        ["pageSize", "-1"],
        ["filters", "%%%"],
        ["filters", base64Json(["status"])],
        ["filters", base64Json({ "status: {_neq": ["x"] })],
        ["filters", base64Json({ status: "queued" })],
        ["filters", base64Json({ status: [{ _neq: "x" }] })],
      ])("rejects %s=%s", async (param, value) => {
        await t
          .http()
          .get("/v1/dionysus/jobs/metadata/scroll")
          .query({ [param]: value })
          .expect(400);

        expect(t.graphql.calls("ScrollMetadataFetchJobs")).toHaveLength(0);
      });
    });

    describe("GET /v1/dionysus/job/metadata/stats (GetMetadataFetchJobStatistics)", () => {
      it("returns status counts and expiration buckets per type", async () => {
        t.graphql.on("GetMetadataFetchJobStatistics", {
          dionysus_metadata_fetch_status_statistics: [
            { type: "movies", status: "fetched", count: 120 },
            { type: "tv_series", status: "queued", count: 4 },
          ],
          dionysus_metadata_fetch_status_expiration_statistics: [
            { type: "movies", ttl_days: 3, count: 11 },
          ],
        });

        const res = await t.http().get("/v1/dionysus/job/metadata/stats");

        expect(res.status).toBe(200);
        const { status, expiration } = res.body;
        expect(status.categories.slice(0, 2)).toEqual(["Movies", "TV Series"]);
        expect(status.series.fetched[0]).toBe(120);
        expect(status.series.queued[1]).toBe(4);
        const movies = expiration.series.find(
          (s: { name: string }) => s.name === "movies",
        );
        expect(movies.data).toHaveLength(26);
        expect(movies.data[3]).toBe(11);
      });
    });
  });
});
