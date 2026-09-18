import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../support/testApp";

describe("GET /v1/olympus/ping", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });

  it("reports the configured hosts", async () => {
    const res = await t.http().get("/v1/olympus/ping");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      config: {
        "hasura.host": "hasura.test",
        "amqp.host": "amqp.test",
      },
    });
  });
});
