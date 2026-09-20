import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/AppModule";
import { configureApp } from "../../src/configureApp";
import { issueE2eAccessToken } from "./auth-fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Overrides (e2e)", () => {
  let app: INestApplication;
  let authHeader: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    authHeader = `Bearer ${issueE2eAccessToken(app)}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects requests with no access token", () => {
    return request(app.getHttpServer())
      .get(
        "/v1/override-blocks?start=2026-01-05T00:00:00.000Z&end=2026-01-06T00:00:00.000Z",
      )
      .expect(401);
  });

  it("creates, lists, and deletes an override block", async () => {
    const created = await request(app.getHttpServer())
      .post("/v1/override-blocks")
      .set("Authorization", authHeader)
      .send({
        overrideBlock: {
          startTime: "2026-01-05T15:00:00.000Z",
          endTime: "2026-01-05T16:00:00.000Z",
          status: "busy",
          label: "Focus time",
        },
      })
      .expect(201);
    expect(created.body.overrideBlock).toMatchObject({
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T16:00:00.000Z",
      status: "busy",
      label: "Focus time",
    });
    expect(created.body.overrideBlock.id).toBeTruthy();

    const listed = await request(app.getHttpServer())
      .get(
        "/v1/override-blocks?start=2026-01-05T00:00:00.000Z&end=2026-01-06T00:00:00.000Z",
      )
      .set("Authorization", authHeader)
      .expect(200);
    expect(
      listed.body.overrideBlocks.map((b: { id: string }) => b.id),
    ).toContain(created.body.overrideBlock.id);

    await request(app.getHttpServer())
      .delete(`/v1/override-block/${created.body.overrideBlock.id}`)
      .set("Authorization", authHeader)
      .expect(204);

    const afterDelete = await request(app.getHttpServer())
      .get(
        "/v1/override-blocks?start=2026-01-05T00:00:00.000Z&end=2026-01-06T00:00:00.000Z",
      )
      .set("Authorization", authHeader)
      .expect(200);
    expect(
      afterDelete.body.overrideBlocks.map((b: { id: string }) => b.id),
    ).not.toContain(created.body.overrideBlock.id);
  });

  it("updates the status of an existing override block", async () => {
    const created = await request(app.getHttpServer())
      .post("/v1/override-blocks")
      .set("Authorization", authHeader)
      .send({
        overrideBlock: {
          startTime: "2026-01-05T15:00:00.000Z",
          endTime: "2026-01-05T16:00:00.000Z",
          status: "busy",
        },
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .put(`/v1/override-block/${created.body.overrideBlock.id}`)
      .set("Authorization", authHeader)
      .send({ overrideBlock: { status: "free" } })
      .expect(200);
    expect(updated.body.overrideBlock).toMatchObject({
      id: created.body.overrideBlock.id,
      status: "free",
    });
  });

  it("UpdateOverrideBlock 404s for an unknown id", () => {
    return request(app.getHttpServer())
      .put("/v1/override-block/does-not-exist")
      .set("Authorization", authHeader)
      .send({ overrideBlock: { status: "free" } })
      .expect(404);
  });

  it("rejects a block where startTime is not before endTime", () => {
    return request(app.getHttpServer())
      .post("/v1/override-blocks")
      .set("Authorization", authHeader)
      .send({
        overrideBlock: {
          startTime: "2026-01-05T16:00:00.000Z",
          endTime: "2026-01-05T15:00:00.000Z",
          status: "busy",
        },
      })
      .expect(400);
  });

  it("rejects an invalid status value", () => {
    return request(app.getHttpServer())
      .post("/v1/override-blocks")
      .set("Authorization", authHeader)
      .send({
        overrideBlock: {
          startTime: "2026-01-05T15:00:00.000Z",
          endTime: "2026-01-05T16:00:00.000Z",
          status: "bogus",
        },
      })
      .expect(400);
  });
});
