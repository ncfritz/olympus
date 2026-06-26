import "source-map-support/register";

import { VersioningType } from "@nestjs/common";
import { NestFactory, PartialGraphHost, Reflector } from "@nestjs/core";
import cookieParser from "cookie-parser";
import * as bodyParser from "body-parser";
import * as fs from "fs";
import { WinstonModule } from "nest-winston";
import { PrometheusMetricsInterceptor } from "./middleware/PrometheusOperationMetricsInterceptor";
import { AppModule } from "./module/AppModule";
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
  //app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  // Allow larger body size
  app.use(bodyParser.json({ limit: 1024 * 1024 * 10, inflate: true }));
  app.use(bodyParser.urlencoded({ limit: 1024 * 1024 * 200, extended: true }));
  app.enableCors({
    origin: ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  });
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.getHttpServer().setTimeout(2 * 60 * 1000);
  app.useGlobalInterceptors(new PrometheusMetricsInterceptor(new Reflector()));

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
