import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";

// The full "a real channel triggers SyncEngine" path is covered by
// WebhookNotifier's own unit tests against a fake CalendarProvider — doing
// that here would need a live Google- or Microsoft-registered channel,
// which needs real network access this test suite deliberately never
// touches. What's left to verify at this layer is the HTTP surface itself:
// it must be reachable with no access token (neither provider can present
// one), must never 500 on a handshake or an unrecognized channel, and for
// Microsoft specifically must echo the validationToken synchronously as
// text/plain (see microsoft-webhooks.controller.ts).
describe("Webhooks (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("accepts a notification with no access token", () => {
    return request(app.getHttpServer())
      .post("/webhooks/google")
      .set("x-goog-channel-id", "chan-1")
      .set("x-goog-resource-state", "exists")
      .expect(200);
  });

  it('accepts the initial "sync" handshake with no channel id', () => {
    return request(app.getHttpServer())
      .post("/webhooks/google")
      .set("x-goog-resource-state", "sync")
      .expect(200);
  });

  it("accepts a notification for an unrecognized channel without error", () => {
    return request(app.getHttpServer())
      .post("/webhooks/google")
      .set("x-goog-channel-id", "never-registered")
      .set("x-goog-resource-state", "exists")
      .set("x-goog-channel-token", "anything")
      .expect(200);
  });

  it("echoes the validationToken as text/plain for a Microsoft subscription handshake", async () => {
    const res = await request(app.getHttpServer())
      .post("/webhooks/microsoft")
      .query({ validationToken: "echo-me" })
      .expect(200);

    expect(res.text).toBe("echo-me");
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
  });

  it("accepts a batched Microsoft change notification for an unrecognized subscription without error", () => {
    return request(app.getHttpServer())
      .post("/webhooks/microsoft")
      .send({
        value: [
          { subscriptionId: "never-registered", clientState: "anything" },
        ],
      })
      .expect(202);
  });

  it("accepts a Microsoft notification body with no entries", () => {
    return request(app.getHttpServer())
      .post("/webhooks/microsoft")
      .send({ value: [] })
      .expect(202);
  });
});
