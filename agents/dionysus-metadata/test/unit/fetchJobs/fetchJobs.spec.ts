import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobApi } from "@ncfritz/olympus-client";
import { FetchJobs } from "../../../src/fetchJobs/FetchJobs";
import { SqliteFetchJobCache } from "../../../src/fetchJobs/SqliteFetchJobCache";
import { fetchJob } from "../../fixtures/fakes";

describe("fetch jobs", () => {
  let dir: string;
  let cache: SqliteFetchJobCache;
  let api: {
    describeMetadataFetchJob: ReturnType<typeof vi.fn>;
    createMetadataFetchJob: ReturnType<typeof vi.fn>;
    updateMetadataFetchJob: ReturnType<typeof vi.fn>;
  };
  let fetchJobs: FetchJobs;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "fetch-jobs-"));
    cache = new SqliteFetchJobCache({ path: path.join(dir, "cache") });
    api = {
      describeMetadataFetchJob: vi.fn(async (id: string) => fetchJob({ id })),
      createMetadataFetchJob: vi.fn(async ({ id, status }) =>
        fetchJob({ id, status }),
      ),
      updateMetadataFetchJob: vi.fn(async (id: string) =>
        fetchJob({ id, status: "fetched" }),
      ),
    };
    fetchJobs = new FetchJobs(cache, api as unknown as JobApi);
  });

  afterEach(async () => {
    await cache.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const caching = { readCachingEnabled: true, writeCachingEnabled: true };

  it("creates the cache directory and database on first use", async () => {
    await fetchJobs.store(caching);
    expect(fs.existsSync(path.join(dir, "cache", "jobCache.db"))).toBe(true);
  });

  it("reads through the cache", async () => {
    const store = await fetchJobs.store(caching);
    await store.getMetadataFetchJob("603", "movies", false);
    await store.getMetadataFetchJob("603", "movies", false);
    expect(api.describeMetadataFetchJob).toHaveBeenCalledTimes(1);
    await expect(cache.get("movies:603")).resolves.toMatchObject({ id: "603" });
  });

  it("goes to the API when the cache is bypassed or off", async () => {
    let store = await fetchJobs.store(caching);
    await store.getMetadataFetchJob("603", "movies", false);
    await store.getMetadataFetchJob("603", "movies", true);
    store = await fetchJobs.store({
      readCachingEnabled: false,
      writeCachingEnabled: false,
    });
    await store.getMetadataFetchJob("603", "movies", false);
    expect(api.describeMetadataFetchJob).toHaveBeenCalledTimes(3);
  });

  it("caches what creates and updates return", async () => {
    const store = await fetchJobs.store(caching);
    await store.createMetadataFetchJob("1", "movies", 30, 10, "queued", true);
    await expect(cache.get("movies:1")).resolves.toMatchObject({
      status: "queued",
    });
    await store.updateMetadataFetchJob("1", "movies", {}, false);
    await expect(cache.get("movies:1")).resolves.toMatchObject({
      status: "fetched",
    });
    expect(api.updateMetadataFetchJob).toHaveBeenCalledWith(
      "1",
      "movies",
      {},
      false,
      false,
    );
  });

  it("creates a fetch job, stamping it fetched now when created fetched", async () => {
    const store = await fetchJobs.store(caching);
    await store.createMetadataFetchJob("1", "movies", 30, 10, "queued", true);
    await store.createMetadataFetchJob(
      "2",
      "movies",
      30,
      10,
      "fetched",
      false,
      {
        seasonId: 4,
      },
    );
    expect(api.createMetadataFetchJob.mock.calls).toEqual([
      [
        {
          id: "1",
          type: "movies",
          ttl: 30,
          jitter: 10,
          status: "queued",
          lastFetchedTime: undefined,
          publishNotification: true,
          context: undefined,
        },
      ],
      [
        {
          id: "2",
          type: "movies",
          ttl: 30,
          jitter: 10,
          status: "fetched",
          lastFetchedTime: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
          publishNotification: false,
          context: { seasonId: 4 },
        },
      ],
    ]);
  });

  it("fails without a cache directory", async () => {
    const unset = new FetchJobs(
      new SqliteFetchJobCache({ path: "" }),
      api as unknown as JobApi,
    );
    await expect(unset.store(caching)).rejects.toThrow();
  });
});
