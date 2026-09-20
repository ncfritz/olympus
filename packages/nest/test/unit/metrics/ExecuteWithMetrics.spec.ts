import { HTTP_CLIENT_REQUEST_DURATION } from "@ncfritz/olympus-metrics";
import { register } from "prom-client";
import { beforeEach, describe, expect, it } from "vitest";
import { ExecuteWithMetrics } from "../../../src/metrics/ExecuteWithMetrics";
import { requestCounts } from "../../support/metrics";

type Response = { status?: number; config?: { method?: string } };

class TmdbClient {
  next: () => Promise<Response> = async () => ({
    status: 200,
    config: { method: "get" },
  });

  @ExecuteWithMetrics("TMDB.Movie.Details")
  async movie(): Promise<Response | undefined> {
    return this.next();
  }

  @ExecuteWithMetrics("SendNotification", {
    server: "olympus-api",
    api: "olympus",
    tag: "Notifications",
  })
  async notify(): Promise<Response | undefined> {
    return this.next();
  }
}

const counts = () => requestCounts(HTTP_CLIENT_REQUEST_DURATION);
const labels = (overrides: Record<string, string> = {}) =>
  JSON.stringify({
    client: "unknown",
    server: "tmdb",
    api: "tmdb",
    tag: "unknown",
    operation: "Movie.Details",
    method: "GET",
    status_code: "200",
    ...overrides,
  });

describe("ExecuteWithMetrics", () => {
  beforeEach(() => register.resetMetrics());

  it("records the call, taking the service from the operation's prefix", async () => {
    await expect(new TmdbClient().movie()).resolves.toMatchObject({
      status: 200,
    });
    expect(await counts()).toEqual({ [labels()]: 1 });
  });

  it("records an explicit target", async () => {
    await new TmdbClient().notify();
    expect(await counts()).toEqual({
      [JSON.stringify({
        client: "unknown",
        server: "olympus-api",
        api: "olympus",
        tag: "Notifications",
        operation: "SendNotification",
        method: "GET",
        status_code: "200",
      })]: 1,
    });
  });

  it("records the status of a failed call", async () => {
    const client = new TmdbClient();
    client.next = async () => {
      throw Object.assign(new Error("down"), {
        response: { status: 503, config: { method: "get" } },
      });
    };
    await expect(client.movie()).rejects.toThrow("down");
    expect(await counts()).toEqual({ [labels({ status_code: "503" })]: 1 });
  });

  it("records a call that got no response", async () => {
    const client = new TmdbClient();
    client.next = async () => {
      throw Object.assign(new Error("timeout"), {
        request: {},
        config: { method: "get" },
      });
    };
    await expect(client.movie()).rejects.toThrow("timeout");
    expect(await counts()).toEqual({ [labels({ status_code: "none" })]: 1 });
  });

  it("resolves a 404 to undefined", async () => {
    const client = new TmdbClient();
    client.next = async () => {
      throw Object.assign(new Error("not found"), {
        response: { status: 404, config: { method: "get" } },
      });
    };
    await expect(client.movie()).resolves.toBeUndefined();
    expect(await counts()).toEqual({ [labels({ status_code: "404" })]: 1 });
  });
});
