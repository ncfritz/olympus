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

  it("serves Prometheus metrics at /metrics without an access token", async () => {
    const res = await request(app.getHttpServer())
      .get("/metrics")
      .expect(200)
      .expect("Content-Type", /text\/plain/);
    expect(res.text).toContain("process_cpu_user_seconds_total");
  });

  it("records the management API's operations", async () => {
    await request(app.getHttpServer())
      .get("/v1/calendars")
      .set("Authorization", `Bearer ${issueE2eAccessToken(app)}`)
      .expect(200);

    const res = await request(app.getHttpServer()).get("/metrics").expect(200);
    expect(res.text).toMatch(
      /^operation_ListCalendars_count(\{[^}]*\})? [1-9]/m,
    );
    expect(res.text).toMatch(/^operation_ListCalendars_2xx(\{[^}]*\})? [1-9]/m);
  });

  it("records the status of a failed operation", async () => {
    await request(app.getHttpServer())
      .get("/v1/sync-run/no-such-run")
      .set("Authorization", `Bearer ${issueE2eAccessToken(app)}`)
      .expect(404);

    const res = await request(app.getHttpServer()).get("/metrics").expect(200);
    expect(res.text).toMatch(
      /^operation_DescribeSyncRun_4xx(\{[^}]*\})? [1-9]/m,
    );
    expect(res.text).toMatch(
      /^operation_DescribeSyncRun_error(\{[^}]*\})? [1-9]/m,
    );
  });
});
