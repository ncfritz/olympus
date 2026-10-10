import "source-map-support/register";

import {
  createWinstonLogger,
  reportBootstrapFailure,
} from "@ncfritz/olympus-nest";
import { Logger } from "@nestjs/common";
import { NestFactory, PartialGraphHost } from "@nestjs/core";
import { WinstonModule } from "nest-winston";
import { AppModule } from "./AppModule";
import { readConfig } from "./config/configuration";
import { configureApp } from "./configureApp";
import { buildOpenApiDocument } from "./openapi/documentBuilder";

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
  app.enableShutdownHooks();
  // The CA console, when it is served from another origin (in development).
  const webAppUrl = config.auth.console?.webAppUrl;
  if (webAppUrl) {
    app.enableCors({ origin: new URL(webAppUrl).origin, credentials: true });
  }
  configureApp(app);

  if (config.server.apiExplorer) {
    buildOpenApiDocument(app);
  }

  await app.listen(config.server.port);
}

bootstrap()
  .then(() => {
    logger.log("Harpocrates bootstrap complete.");
  })
  .catch((e: unknown) => {
    reportBootstrapFailure(e, PartialGraphHost, logger);
    process.exit(1);
  });
