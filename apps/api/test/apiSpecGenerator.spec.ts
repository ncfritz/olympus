import { beforeAll, describe, afterAll, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { HttpModule } from "@nestjs/axios";
import * as fs from "fs";
import { AppModule } from "../src/module/AppModule";

import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { buildOpenApiDocument } from "../src/schema/documentBuilder";
import {
  DionysusApiConfig,
  MinervaApiConfig,
  OlympusApiConfig,
} from "../src/schema/schemas";

AmqpConnection.prototype.init = jest.fn();
AmqpConnection.prototype.close = jest.fn();

describe("OpenAPI spec generator", () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!fs.existsSync("./dist/openapi")) {
      fs.mkdirSync("./dist/openapi");
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule, AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("generates Olympus swagger spec", async () => {
    const document = buildOpenApiDocument(app, OlympusApiConfig, false);
    fs.writeFileSync(
      "./dist/openapi/olympus-openapi-spec.json",
      JSON.stringify(document, null, 2),
    );
  });

  it("generates Dionysus swagger spec", async () => {
    const document = buildOpenApiDocument(app, DionysusApiConfig, false);
    fs.writeFileSync(
      "./dist/openapi/dionysus-openapi-spec.json",
      JSON.stringify(document, null, 2)
    );
  });

  it("generates Minerva swagger spec", async () => {
    const document = buildOpenApiDocument(app, MinervaApiConfig, false);
    fs.writeFileSync(
      "./dist/openapi/minerva-openapi-spec.json",
      JSON.stringify(document, null, 2)
    );
  });
});
