import { ValidationPipe } from "@nestjs/common";
import { NestFactory, PartialGraphHost } from "@nestjs/core";
import cookieParser from "cookie-parser";
import fs from "fs";
import { WinstonModule } from "nest-winston";
import { AppModule } from "./module/AppModule";
import { logger } from "./util/logger";
import * as v8 from "v8";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  app.enableCors({
    origin: ["http://localhost:3000", "https://dionysus.dev.ncfritz.net"],
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  });

  await app.listen(3100);
}

bootstrap()
  .then(() => {
    logger.info("🔥🔥🔥 Olympus Metadata Agent bootstrap complete.");
    logger.info(JSON.stringify(v8.getHeapStatistics(), null, 2));
  })
  .catch((e) => {
    logger.error("🤯🤯🤯 Error during bootstrap!", e);
    fs.writeFileSync("graph.json", PartialGraphHost.toString() ?? "");
    process.exit(1);
  });
