import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../src/AppModule";
import { configureApp } from "../../src/configureApp";
import { buildOpenApiDocument } from "../../src/openapi/documentBuilder";

/** The management API's document, served as main.ts does with the API explorer on. */
describe("API spec (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    buildOpenApiDocument(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves the committed document at /api-spec-json without an access token", async () => {
    const committed = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../openapi/minerva-calendar-sync.json"),
        "utf8",
      ),
    );

    const res = await request(app.getHttpServer())
      .get("/api-spec-json")
      .expect(200);
    expect(res.body.paths).toEqual(committed.paths);
    expect(res.body.components).toEqual(committed.components);
  });

  it("leaves the provider callbacks out", async () => {
    const res = await request(app.getHttpServer())
      .get("/api-spec-json")
      .expect(200);
    const paths = Object.keys(res.body.paths);
    expect(paths.every((p) => p.startsWith("/v1/"))).toBe(true);
  });

  it("serves Swagger UI at /api-spec", async () => {
    await request(app.getHttpServer())
      .get("/api-spec")
      .expect(200)
      .expect("Content-Type", /html/);
  });
});
