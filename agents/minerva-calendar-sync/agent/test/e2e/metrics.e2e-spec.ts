import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../src/AppModule";
import { configureApp } from "../../src/configureApp";
import { issueE2eAccessToken } from "./auth-fixtures";

describe("Metrics (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  /** A request histogram series with these labels and a count. */
  const series = (labels: string) =>
    new RegExp(
      `^http_server_request_duration_seconds_count\\{[^}]*${labels}[^}]*\\} [1-9]`,
      "m",
    );

  it("serves Prometheus metrics at /metrics without an access token", async () => {
    const res = await request(app.getHttpServer())
      .get("/metrics")
      .expect(200)
      .expect("Content-Type", /text\/plain/);
    expect(res.text).toContain("process_cpu_user_seconds_total");
  });

  it("answers Docker's health check without an access token", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("records the management API's operations by caller", async () => {
    await request(app.getHttpServer())
      .get("/v1/calendars")
      .set("Authorization", `Bearer ${issueE2eAccessToken(app)}`)
      .set("X-Olympus-Client", "minerva-calendar-sync-console")
      .expect(200);

    const res = await request(app.getHttpServer()).get("/metrics").expect(200);
    expect(res.text).toMatch(
      series(
        'client="minerva-calendar-sync-console",server="[^"]+",api="minerva-calendar-sync",tag="Calendars",operation="ListCalendars",method="GET",status_code="200"',
      ),
    );
  });

  it("records failed and rejected requests with their status", async () => {
    await request(app.getHttpServer())
      .get("/v1/sync-run/no-such-run")
      .set("Authorization", `Bearer ${issueE2eAccessToken(app)}`)
      .expect(404);
    await request(app.getHttpServer()).get("/v1/sync-runs").expect(401);

    const res = await request(app.getHttpServer()).get("/metrics").expect(200);
    expect(res.text).toMatch(
      series('operation="DescribeSyncRun",method="GET",status_code="404"'),
    );
    expect(res.text).toMatch(
      series(
        'client="unknown",[^}]*operation="ListSyncRuns",method="GET",status_code="401"',
      ),
    );
  });

  it("records the agent's own metrics", async () => {
    const res = await request(app.getHttpServer()).get("/metrics").expect(200);
    expect(res.text).toContain("# TYPE sync_runs_total counter");
    expect(res.text).toContain("# TYPE outbox_publishes_total counter");
  });
});
