import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/AppModule";
import { configureApp } from "../../src/configureApp";
import { issueE2eAccessToken } from "./auth-fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Calendar colors (e2e)", () => {
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
    return request(app.getHttpServer()).get("/v1/calendar-colors").expect(401);
  });

  it("lists an empty map when nothing is stored", async () => {
    const listed = await request(app.getHttpServer())
      .get("/v1/calendar-colors")
      .set("Authorization", authHeader)
      .expect(200);
    expect(listed.body.calendarColors).toEqual({});
  });

  it("sets a color for a source and lists it back", async () => {
    await request(app.getHttpServer())
      .put("/v1/calendar-color/personal-gmail")
      .set("Authorization", authHeader)
      .send({ calendarColor: { color: "#1677ff" } })
      .expect(200);

    const listed = await request(app.getHttpServer())
      .get("/v1/calendar-colors")
      .set("Authorization", authHeader)
      .expect(200);
    expect(listed.body.calendarColors).toEqual({ "personal-gmail": "#1677ff" });
  });

  it("overwrites an existing color for the same source", async () => {
    await request(app.getHttpServer())
      .put("/v1/calendar-color/personal-gmail")
      .set("Authorization", authHeader)
      .send({ calendarColor: { color: "#1677ff" } })
      .expect(200);
    await request(app.getHttpServer())
      .put("/v1/calendar-color/personal-gmail")
      .set("Authorization", authHeader)
      .send({ calendarColor: { color: "#f5222d" } })
      .expect(200);

    const listed = await request(app.getHttpServer())
      .get("/v1/calendar-colors")
      .set("Authorization", authHeader)
      .expect(200);
    expect(listed.body.calendarColors).toEqual({ "personal-gmail": "#f5222d" });
  });

  it('accepts a source with no configured calendar, e.g. the "Overrides" pseudo-source', async () => {
    await request(app.getHttpServer())
      .put("/v1/calendar-color/Overrides")
      .set("Authorization", authHeader)
      .send({ calendarColor: { color: "#f5222d" } })
      .expect(200);

    const listed = await request(app.getHttpServer())
      .get("/v1/calendar-colors")
      .set("Authorization", authHeader)
      .expect(200);
    expect(listed.body.calendarColors).toEqual({ Overrides: "#f5222d" });
  });

  it("rejects a non-hex color", () => {
    return request(app.getHttpServer())
      .put("/v1/calendar-color/personal-gmail")
      .set("Authorization", authHeader)
      .send({ calendarColor: { color: "blue" } })
      .expect(400);
  });
});
