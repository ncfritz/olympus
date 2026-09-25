import type { INestApplication } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "../../src/openapi/documentBuilder";
import { createApp } from "../support/app";

/** The management API's document, served as main.ts does with the API explorer on. */
describe("API spec (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
    buildOpenApiDocument(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves the committed document at /api-spec-json", async () => {
    const committed = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../openapi/harpocrates.json"),
        "utf8",
      ),
    );
    const res = await request(app.getHttpServer())
      .get("/api-spec-json")
      .expect(200);
    expect(res.body.paths).toEqual(committed.paths);
    expect(res.body.info.title).toBe("Harpocrates API");
  });

  it("leaves health and metrics out", async () => {
    const res = await request(app.getHttpServer())
      .get("/api-spec-json")
      .expect(200);
    const paths = Object.keys(res.body.paths);
    expect(paths.every((p) => p.startsWith("/v1/"))).toBe(true);
  });
});
