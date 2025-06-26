import { beforeAll, describe, afterAll, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { HttpModule } from "@nestjs/axios";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import * as fs from "fs";
import { AppModule } from "../src/module/AppModule";

import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";

AmqpConnection.prototype.init = jest.fn();
AmqpConnection.prototype.close = jest.fn();

describe("OpenAPI spec generator", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule, AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should generate swagger spec", async () => {
    const config = new DocumentBuilder()
      .setTitle("olympus-api")
      .setDescription("Olympus API")
      .setVersion("1.0")
      .setContact("Neil Fritz", "https://ncfritz.net", "ncfritz@ncfritz.net")
      .addTag("Olympus")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    fs.writeFileSync("./dist/openapi-spec.json", JSON.stringify(document));
  });
});
