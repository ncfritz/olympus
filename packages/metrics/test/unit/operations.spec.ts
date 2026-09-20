import { describe, expect, it } from "vitest";
import {
  createOperationLookup,
  operationsFromOpenApi,
  UNKNOWN,
} from "../../src";

const document = {
  paths: {
    "/dionysus/metadata/movie/{movieId}": {
      get: { operationId: "DescribeMovie", tags: ["Metadata"] },
      put: { operationId: "UpdateMovie", tags: ["Metadata"] },
      parameters: [],
    },
    "/dionysus/metadata/movies": {
      post: { operationId: "CreateMovie", tags: ["Metadata"] },
    },
    "/sync-runs/{syncRunId}": {
      get: { operationId: "DescribeSyncRun", tags: ["Sync Runs"] },
    },
    "/sync-runs/stats": {
      get: { operationId: "GetSyncRunStats" },
    },
    "/untagged": { get: { summary: "no operationId" } },
  },
};

describe("operationsFromOpenApi", () => {
  it("lists every operation with an operationId", () => {
    expect(operationsFromOpenApi("dionysus", document)).toEqual([
      {
        api: "dionysus",
        method: "GET",
        path: "/dionysus/metadata/movie/{movieId}",
        operationId: "DescribeMovie",
        tag: "Metadata",
      },
      {
        api: "dionysus",
        method: "PUT",
        path: "/dionysus/metadata/movie/{movieId}",
        operationId: "UpdateMovie",
        tag: "Metadata",
      },
      {
        api: "dionysus",
        method: "POST",
        path: "/dionysus/metadata/movies",
        operationId: "CreateMovie",
        tag: "Metadata",
      },
      {
        api: "dionysus",
        method: "GET",
        path: "/sync-runs/{syncRunId}",
        operationId: "DescribeSyncRun",
        tag: "Sync Runs",
      },
      {
        api: "dionysus",
        method: "GET",
        path: "/sync-runs/stats",
        operationId: "GetSyncRunStats",
        tag: UNKNOWN,
      },
    ]);
  });
});

describe("createOperationLookup", () => {
  const find = createOperationLookup(
    operationsFromOpenApi("dionysus", document),
  );
  const id = (method: string, path: string) => find(method, path)?.operationId;

  it("matches a concrete path, ignoring the query and a trailing slash", () => {
    expect(id("get", "/dionysus/metadata/movie/603")).toBe("DescribeMovie");
    expect(id("PUT", "/dionysus/metadata/movie/603/?x=1")).toBe("UpdateMovie");
    expect(id("POST", "/dionysus/metadata/movies")).toBe("CreateMovie");
  });

  it("matches an Express route template", () => {
    expect(id("GET", "/dionysus/metadata/movie/:movieId")).toBe(
      "DescribeMovie",
    );
  });

  it("prefers a static path over a parameter", () => {
    expect(id("GET", "/sync-runs/stats")).toBe("GetSyncRunStats");
    expect(id("GET", "/sync-runs/run-1")).toBe("DescribeSyncRun");
  });

  it("finds nothing for another method or path", () => {
    expect(find("DELETE", "/dionysus/metadata/movie/603")).toBeUndefined();
    expect(find("GET", "/dionysus/metadata/movie/603/extra")).toBeUndefined();
    expect(find("GET", "/dionysus/metadata/movie/:other/x")).toBeUndefined();
  });

  it("strips a version prefix the documents omit", () => {
    const versioned = createOperationLookup(
      operationsFromOpenApi("dionysus", document),
      { stripPrefix: "/v1" },
    );
    expect(
      versioned("GET", "/v1/dionysus/metadata/movie/:movieId")?.operationId,
    ).toBe("DescribeMovie");
    expect(versioned("GET", "/v1/dionysus/metadata/movie/1")?.operationId).toBe(
      "DescribeMovie",
    );
  });
});
