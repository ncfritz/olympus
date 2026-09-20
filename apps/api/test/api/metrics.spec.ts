import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../support/testApp";

/** Request metrics (ADR 0017), as Prometheus scrapes them from /metrics. */
describe("GET /metrics", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });

  const series = (labels: string) =>
    new RegExp(
      `^http_server_request_duration_seconds_count\\{app="olympus-api-test",environment="test",${labels}\\} [1-9]`,
      "m",
    );

  it("records each operation by caller, API, tag and status", async () => {
    await t
      .http()
      .get("/v1/olympus/ping")
      .set("X-Olympus-Client", "dionysus-search-agent")
      .expect(200);
    await t.http().get("/v1/olympus/ping").expect(200);

    const res = await t.http().get("/metrics").expect(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.text).toMatch(
      series(
        'client="dionysus-search-agent",server="olympus-api-test",api="olympus",tag="Admin",operation="Ping",method="GET",status_code="200"',
      ),
    );
    expect(res.text).toMatch(
      series('client="unknown",[^}]*operation="Ping",[^}]*'),
    );
  });

  it("does not record requests outside the API documents", async () => {
    await t.http().get("/v1/nothing-here").expect(404);
    const res = await t.http().get("/metrics").expect(200);
    expect(res.text).not.toMatch(/operation="(unknown|)"/);
    expect(res.text).not.toMatch(
      /http_server_request_duration_seconds_count\{[^}]*status_code="404"/,
    );
  });
});
