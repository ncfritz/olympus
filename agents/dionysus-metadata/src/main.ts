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

const logger = new Logger("Bootstrap");

async function bootstrap() {
  // Fails fast, listing every invalid variable, before anything connects.
  const config = readConfig(process.env);

  const app = await NestFactory.create(AppModule, {
    snapshot: true,
    abortOnError: false,
    logger: WinstonModule.createLogger({
      instance: createWinstonLogger(config.logging, config.runtime.appName),
    }),
  });

  // On SIGTERM/SIGINT, Nest awaits the shutdown hooks before exiting:
  // ExecutionRegistry fails the workflows and batch jobs still running.
  app.enableShutdownHooks();

  // The HTTP listener only serves /metrics.
  await app.listen(config.runtime.port);
}

bootstrap()
  .then(() => {
    logger.log("🔥🔥🔥 Olympus Metadata Agent bootstrap complete.");
  })
  .catch((e: unknown) => {
    reportBootstrapFailure(e, PartialGraphHost, logger);
    process.exit(1);
  });
