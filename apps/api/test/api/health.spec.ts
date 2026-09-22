import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../support/testApp";

/** Docker's health check (ADR 0019): public, and outside the API documents. */
describe("GET /health", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });

  it("answers without credentials", async () => {
    const res = await t.http().get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("is public, so the guard records nothing it would reject", async () => {
    await t.http().get("/health").expect(200);
    const metrics = (await t.http().get("/metrics").expect(200)).text;
    expect(metrics).not.toMatch(
      /^auth_decisions_total\{[^}]*outcome="would_reject"/m,
    );
  });

  it("is not an operation, so it is not timed", async () => {
    await t.http().get("/health").expect(200);
    const metrics = (await t.http().get("/metrics").expect(200)).text;
    expect(metrics).not.toMatch(
      /http_server_request_duration_seconds_count\{[^}]*\/health/,
    );
    expect(metrics).not.toMatch(/operation="[^"]*Health/);
  });
});
