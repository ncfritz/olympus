import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../support/testApp";

describe("POST /v1/olympus/amqp/test/:exchange (SendAmqpTestMessage)", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => t.reset());

  it("publishes the body to the exchange with the routing key", async () => {
    const body = { payload: { hello: "world" } };

    await t
      .http()
      .post("/v1/olympus/amqp/test/notifications.trigger?routingKey=a.b")
      .send(body)
      .expect(200);

    expect(t.amqp.publish).toHaveBeenCalledWith(
      "notifications.trigger",
      "a.b",
      body,
    );
  });

  it("defaults the routing key to #", async () => {
    await t
      .http()
      .post("/v1/olympus/amqp/test/x")
      .send({ payload: 1 })
      .expect(200);

    expect(t.amqp.publish.mock.calls[0][1]).toBe("#");
  });

  it("returns 500 when the broker rejects the message", async () => {
    t.amqp.publish.mockRejectedValueOnce(new Error("unroutable"));

    await t
      .http()
      .post("/v1/olympus/amqp/test/x")
      .send({ payload: 1 })
      .expect(500);
  });
});
