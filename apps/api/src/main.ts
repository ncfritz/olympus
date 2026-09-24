import "source-map-support/register";

import { Logger } from "@nestjs/common";
import { NestFactory, PartialGraphHost } from "@nestjs/core";
import {
  createWinstonLogger,
  reportBootstrapFailure,
} from "@ncfritz/olympus-nest";
import { WinstonModule } from "nest-winston";
import { AppModule } from "./AppModule";
import { readConfig } from "./config/configuration";
import { createServicesListener } from "./auth/servicesListener";
import { configureApp } from "./configureApp";
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

  if (config.auth.services.enabled) {
    createServicesListener(app, config.auth.services);
  }

  await app.listen(config.server.port);
}

bootstrap()
  .then(() => {
    logger.log("🔥🔥🔥 Olympus API bootstrap complete.");
  })
  .catch((e: unknown) => {
    reportBootstrapFailure(e, PartialGraphHost, logger);
    process.exit(1);
  });
