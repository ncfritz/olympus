import { ValidationPipe } from "@nestjs/common";
import { NestFactory, PartialGraphHost } from "@nestjs/core";
import cookieParser from "cookie-parser";
import fs from "fs";
import { WinstonModule } from "nest-winston";
import { PrometheusMetricsInterceptor } from "./middleware/PrometheusMetricsInterceptor";
import { AppModule } from "./module/AppModule";
import { logger } from "./util/logger";
import "dotenv/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "https://olympus.dev.ncfritz.net",
      "https://olympus.internal.ncfritz.net",
    ],
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  });
  app.useGlobalInterceptors(new PrometheusMetricsInterceptor());

  await app.listen(process.env.LISTEN_PORT || 3100);
}

bootstrap()
  .then(() => {
    logger.info("🔥🔥🔥 Olympus Metadata Agent bootstrap complete.");
  })
  .catch((e) => {
    logger.error("🤯🤯🤯 Error during bootstrap!", e);
    fs.writeFileSync("graph.json", PartialGraphHost.toString() ?? "");
    process.exit(1);
  });
