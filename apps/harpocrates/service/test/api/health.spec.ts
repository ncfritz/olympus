import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../support/app";

describe("health and metrics (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("answers Docker's health check without the database", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("serves Prometheus metrics labelled with the service", async () => {
    const res = await request(app.getHttpServer())
      .get("/metrics")
      .expect(200)
      .expect("Content-Type", /text\/plain/);
    expect(res.text).toContain("process_cpu_user_seconds_total");
    expect(res.text).toMatch(/app="harpocrates-/);
  });
});
