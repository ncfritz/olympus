import { ReporterService } from "nestjs-metrics-reporter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExecuteWithMetrics } from "../../../src/metrics/ExecuteWithMetrics";

vi.mock("nestjs-metrics-reporter", () => ({
  ReporterService: { counter: vi.fn(), histogram: vi.fn() },
}));

class Client {
  next: () => Promise<{ status?: number }> = async () => ({ status: 200 });

  async call(): Promise<{ status?: number } | undefined> {
    return this.next();
  }
}
// Applied by hand: this package's tests run without decorator support.
Object.defineProperty(
  Client.prototype,
  "call",
  ExecuteWithMetrics("Op")(
    Client.prototype,
    "call",
    Object.getOwnPropertyDescriptor(Client.prototype, "call")!,
  ),
);

/** The counters recorded, by name. */
const counters = () =>
  Object.fromEntries(
    vi
      .mocked(ReporterService.counter)
      .mock.calls.map(([name, , value]) => [name, value]),
  );

describe("ExecuteWithMetrics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts the call by status class", async () => {
    await expect(new Client().call()).resolves.toEqual({ status: 200 });
    expect(counters()).toEqual({
      client_Op_count: 1,
      client_Op_error: 0,
      client_Op_fatal: 0,
      client_Op_exception: 0,
      client_Op_1xx: 0,
      client_Op_2xx: 1,
      client_Op_3xx: 0,
      client_Op_4xx: 0,
      client_Op_5xx: 0,
    });
    expect(ReporterService.histogram).toHaveBeenCalledWith(
      "client_Op_latency",
      expect.any(Number),
    );
  });

  it("marks 5xx responses fatal", async () => {
    const client = new Client();
    client.next = async () => ({ status: 503 });
    await client.call();
    expect(counters()).toMatchObject({ client_Op_5xx: 1, client_Op_fatal: 1 });
  });

  it("resolves a 404 to undefined", async () => {
    const client = new Client();
    client.next = async () => {
      throw Object.assign(new Error("not found"), {
        response: { status: 404 },
      });
    };
    await expect(client.call()).resolves.toBeUndefined();
    expect(counters()).toMatchObject({ client_Op_exception: 1 });
  });

  it("rethrows other failures", async () => {
    const client = new Client();
    client.next = async () => {
      throw Object.assign(new Error("down"), { request: {} });
    };
    await expect(client.call()).rejects.toThrow("down");
    expect(counters()).toMatchObject({ client_Op_exception: 1 });
  });
});
