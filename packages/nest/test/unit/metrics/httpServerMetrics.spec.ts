import { EventEmitter } from "node:events";
import {
  HTTP_SERVER_REQUEST_DURATION,
  operationsFromOpenApi,
} from "@ncfritz/olympus-metrics";
import { register } from "prom-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpServerMetrics } from "../../../src/metrics/httpServerMetrics";
import { requestCounts } from "../../support/metrics";

const operations = operationsFromOpenApi("dionysus", {
  paths: {
    "/dionysus/metadata/movie/{movieId}": {
      get: { operationId: "DescribeMovie", tags: ["Metadata"] },
    },
  },
});

class FakeResponse extends EventEmitter {
  statusCode = 200;
  writableFinished = false;
  finish(statusCode: number) {
    this.statusCode = statusCode;
    this.writableFinished = true;
    this.emit("finish");
    this.emit("close");
  }
}

const request = (
  originalUrl: string,
  headers: Record<string, string> = {},
  route?: string,
) => ({
  method: "GET",
  originalUrl,
  headers,
  route: route ? { path: route } : undefined,
});

const labels = (overrides: Record<string, string> = {}) =>
  JSON.stringify({
    client: "dionysus-search-agent",
    server: "olympus-api",
    api: "dionysus",
    tag: "Metadata",
    operation: "DescribeMovie",
    method: "GET",
    status_code: "200",
    ...overrides,
  });

describe("httpServerMetrics", () => {
  let middleware: ReturnType<typeof httpServerMetrics>;
  const listOperations = vi.fn(() => operations);

  beforeEach(() => {
    register.resetMetrics();
    listOperations.mockClear();
    middleware = httpServerMetrics({
      server: "olympus-api",
      operations: listOperations,
      stripPrefix: "/v1",
    });
  });

  const serve = (req: ReturnType<typeof request>, status: number) => {
    const response = new FakeResponse();
    const next = vi.fn();
    middleware(req, response, next);
    expect(next).toHaveBeenCalled();
    response.finish(status);
  };

  it("records an operation by its route template, with the caller's name", async () => {
    serve(
      request(
        "/v1/dionysus/metadata/movie/603?x=1",
        { "x-olympus-client": "dionysus-search-agent" },
        "/v1/dionysus/metadata/movie/:movieId",
      ),
      200,
    );
    serve(
      request("/v1/dionysus/metadata/movie/604", {
        "x-olympus-client": "dionysus-search-agent",
      }),
      404,
    );

    expect(await requestCounts(HTTP_SERVER_REQUEST_DURATION)).toEqual({
      [labels()]: 1,
      [labels({ status_code: "404" })]: 1,
    });
    expect(listOperations).toHaveBeenCalledTimes(1);
  });

  it("labels callers without a valid name", async () => {
    serve(request("/v1/dionysus/metadata/movie/1"), 200);
    serve(
      request("/v1/dionysus/metadata/movie/1", {
        "x-olympus-client": "Bad Name",
      }),
      200,
    );
    expect(await requestCounts(HTTP_SERVER_REQUEST_DURATION)).toEqual({
      [labels({ client: "unknown" })]: 1,
      [labels({ client: "other" })]: 1,
    });
  });

  it("records a request whose caller went away without a status", async () => {
    const response = new FakeResponse();
    middleware(request("/v1/dionysus/metadata/movie/1"), response, vi.fn());
    response.emit("close");
    expect(await requestCounts(HTTP_SERVER_REQUEST_DURATION)).toEqual({
      [labels({ client: "unknown", status_code: "none" })]: 1,
    });
  });

  it("ignores requests outside the operations", async () => {
    serve(request("/metrics"), 200);
    serve(request("/v1/unknown"), 404);
    expect(await requestCounts(HTTP_SERVER_REQUEST_DURATION)).toEqual({});
  });
});
