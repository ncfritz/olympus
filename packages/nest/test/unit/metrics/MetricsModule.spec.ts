import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MetricsModule,
  metricsClientName,
} from "../../../src/metrics/MetricsModule";
import type { INestApplication } from "@nestjs/common";

describe("MetricsModule", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MetricsModule.forRootAsync({
          useFactory: () => ({ app: "test-agent", environment: "test" }),
        }),
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves Prometheus metrics labelled with the app and environment", async () => {
    const res = await request(app.getHttpServer())
      .get("/metrics")
      .expect(200)
      .expect("Content-Type", /text\/plain/);
    expect(res.text).toMatch(
      /^process_cpu_user_seconds_total\{app="test-agent",environment="test"\} /m,
    );
  });

  it("names the service as the client of its outbound requests", () => {
    expect(metricsClientName()).toBe("test-agent");
  });
});
