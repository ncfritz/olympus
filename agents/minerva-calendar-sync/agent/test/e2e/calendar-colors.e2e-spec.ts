import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../../src/app.module";
import { issueE2eAccessToken } from "./auth-fixtures";

describe("Calendar colors (e2e)", () => {
  let app: INestApplication;
  let authHeader: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    authHeader = `Bearer ${issueE2eAccessToken(app)}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects requests with no access token", () => {
    return request(app.getHttpServer()).get("/calendar-colors").expect(401);
  });

  it("lists an empty map when nothing is stored", async () => {
    const listed = await request(app.getHttpServer())
      .get("/calendar-colors")
      .set("Authorization", authHeader)
      .expect(200);
    expect(listed.body).toEqual({});
  });

  it("sets a color for a source and lists it back", async () => {
    await request(app.getHttpServer())
      .put("/calendar-colors/personal-gmail")
      .set("Authorization", authHeader)
      .send({ color: "#1677ff" })
      .expect(204);

    const listed = await request(app.getHttpServer())
      .get("/calendar-colors")
      .set("Authorization", authHeader)
      .expect(200);
    expect(listed.body).toEqual({ "personal-gmail": "#1677ff" });
  });

  it("overwrites an existing color for the same source", async () => {
    await request(app.getHttpServer())
      .put("/calendar-colors/personal-gmail")
      .set("Authorization", authHeader)
      .send({ color: "#1677ff" })
      .expect(204);
    await request(app.getHttpServer())
      .put("/calendar-colors/personal-gmail")
      .set("Authorization", authHeader)
      .send({ color: "#f5222d" })
      .expect(204);

    const listed = await request(app.getHttpServer())
      .get("/calendar-colors")
      .set("Authorization", authHeader)
      .expect(200);
    expect(listed.body).toEqual({ "personal-gmail": "#f5222d" });
  });

  it('accepts a source with no configured calendar, e.g. the "Overrides" pseudo-source', async () => {
    await request(app.getHttpServer())
      .put("/calendar-colors/Overrides")
      .set("Authorization", authHeader)
      .send({ color: "#f5222d" })
      .expect(204);

    const listed = await request(app.getHttpServer())
      .get("/calendar-colors")
      .set("Authorization", authHeader)
      .expect(200);
    expect(listed.body).toEqual({ Overrides: "#f5222d" });
  });

  it("rejects a non-hex color", () => {
    return request(app.getHttpServer())
      .put("/calendar-colors/personal-gmail")
      .set("Authorization", authHeader)
      .send({ color: "blue" })
      .expect(400);
  });
});
