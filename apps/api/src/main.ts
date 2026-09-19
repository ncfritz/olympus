import "source-map-support/register";

import { NestFactory, PartialGraphHost } from "@nestjs/core";
import * as fs from "fs";
import { WinstonModule } from "nest-winston";
import { configureApp } from "./configureApp";
import { AppModule } from "./AppModule";
import { buildOpenApiDocument } from "./schema/documentBuilder";
import {
  DionysusApiConfig,
  MinervaApiConfig,
  OlympusApiConfig,
} from "./schema/schemas";
import { IS_PROD } from "./utils/constants";
import { logger } from "./utils/logger";

async function bootstrap() {
  const enableApiExplorer =
    !IS_PROD || process.env.ENABLE_API_EXPLORER === "true";

  const app = await NestFactory.create(AppModule, {
    snapshot: true,
    abortOnError: false,
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });
  configureApp(app);
  app.getHttpServer().setTimeout(2 * 60 * 1000);

  if (enableApiExplorer) {
    buildOpenApiDocument(app, OlympusApiConfig);
    buildOpenApiDocument(app, DionysusApiConfig);
    buildOpenApiDocument(app, MinervaApiConfig);
  }

  await app.listen(process.env.LISTEN_PORT || 3100);
}

bootstrap()
  .then(() => {
    logger.info("🔥🔥🔥 Olympus API bootstrap complete.");
  })
  .catch((e) => {
    logger.error("🤯🤯🤯 Error during bootstrap!", e);

    if (!IS_PROD) {
      fs.writeFileSync("graph.json", PartialGraphHost.toString() ?? "");
    }

    process.exit(1);
  });
