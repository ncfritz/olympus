import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetadataApi } from "../../../src/api/MetadataApi";
import { FetchJobs } from "../../../src/fetchJobs/FetchJobs";
import { SqliteFetchJobCache } from "../../../src/fetchJobs/SqliteFetchJobCache";
import { fetchJob } from "../../fixtures/fakes";

describe("fetch jobs", () => {
  let dir: string;
  let cache: SqliteFetchJobCache;
  let api: {
    getMetadataFetchJob: ReturnType<typeof vi.fn>;
    createMetadataFetchJob: ReturnType<typeof vi.fn>;
    updateMetadataFetchJob: ReturnType<typeof vi.fn>;
  };
  let fetchJobs: FetchJobs;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "fetch-jobs-"));
    cache = new SqliteFetchJobCache({ path: path.join(dir, "cache") });
    api = {
      getMetadataFetchJob: vi.fn(async (id: string) => fetchJob({ id })),
      createMetadataFetchJob: vi.fn(async (id: string) =>
        fetchJob({ id, status: "queued" }),
      ),
      updateMetadataFetchJob: vi.fn(async (id: string) =>
        fetchJob({ id, status: "fetched" }),
      ),
    };
    fetchJobs = new FetchJobs(cache, api as unknown as MetadataApi);
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
    expect(api.getMetadataFetchJob).toHaveBeenCalledTimes(1);
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
    expect(api.getMetadataFetchJob).toHaveBeenCalledTimes(3);
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

  it("fails without a cache directory", async () => {
    const unset = new FetchJobs(
      new SqliteFetchJobCache({ path: "" }),
      api as unknown as MetadataApi,
    );
    await expect(unset.store(caching)).rejects.toThrow();
  });
});
