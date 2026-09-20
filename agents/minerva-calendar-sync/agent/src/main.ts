import "source-map-support/register";

import { createWinstonLogger } from "@ncfritz/olympus-nest";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
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
    logger: WinstonModule.createLogger({
      instance: createWinstonLogger(config.logging, config.server.appName),
    }),
  });
  app.enableShutdownHooks();

  if (config.auth.webAppUrl) {
    app.enableCors({ origin: config.auth.webAppUrl, credentials: true });
  }

  configureApp(app);

  if (config.server.apiExplorer) {
    buildOpenApiDocument(app);
  }

  await app.listen(config.server.port);
}

bootstrap()
  .then(() => {
    logger.log("Minerva calendar sync agent bootstrap complete.");
  })
  .catch((e: unknown) => {
    logger.error(
      "Error during bootstrap!",
      e instanceof Error ? e.stack : String(e),
    );
    process.exit(1);
  });
