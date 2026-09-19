import "source-map-support/register";

import { Logger } from "@nestjs/common";
import { NestFactory, PartialGraphHost } from "@nestjs/core";
import * as fs from "fs";
import { WinstonModule } from "nest-winston";
import { AppModule } from "./AppModule";
import { readConfig } from "./config/configuration";
import { configureApp } from "./configureApp";
import { createWinstonLogger } from "./infra/logging";
import { buildOpenApiDocument } from "./schema/documentBuilder";
import {
  DionysusApiConfig,
  MinervaApiConfig,
  OlympusApiConfig,
} from "./schema/schemas";

const logger = new Logger("Bootstrap");

async function bootstrap(): Promise<void> {
  // Fails fast, listing every invalid variable, before anything connects.
  const config = readConfig(process.env);

  const app = await NestFactory.create(AppModule, {
    snapshot: true,
    abortOnError: false,
    logger: WinstonModule.createLogger({
      instance: createWinstonLogger(config.logging, config.server.appName),
    }),
  });
  configureApp(app);
  app.getHttpServer().setTimeout(2 * 60 * 1000);

  if (config.server.apiExplorer) {
    buildOpenApiDocument(app, OlympusApiConfig);
    buildOpenApiDocument(app, DionysusApiConfig);
    buildOpenApiDocument(app, MinervaApiConfig);
  }

  await app.listen(config.server.port);
}

bootstrap()
  .then(() => {
    logger.log("🔥🔥🔥 Olympus API bootstrap complete.");
  })
  .catch((e: unknown) => {
    logger.error(
      "🤯🤯🤯 Error during bootstrap!",
      e instanceof Error ? e.stack : String(e),
    );

    if (process.env.NODE_ENV !== "production") {
      fs.writeFileSync("graph.json", PartialGraphHost.toString() ?? "");
    }

    process.exit(1);
  });
