import { ValidationPipe } from "@nestjs/common";
import { NestFactory, PartialGraphHost } from "@nestjs/core";
import cookieParser from "cookie-parser";
import Ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import moment from "moment";
import { AppModule } from "./module/AppModule";
import { logger } from "./util/logger";
import { onExit } from "signal-exit";

Ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH!);
Ffmpeg.setFfprobePath(process.env.FFPROBE_PATH!);

const timestamp = moment.utc();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  await app.listen(3102);
}

bootstrap()
  .then(() => {
    logger.info("Installing signal handler...");
    onExit((code, signal) => {
      logger.error(
        `Exit handler triggered on signal ${signal} with code ${code}`,
      );
    });

    logger.info("🔥🔥🔥 Olympus Asser Agent bootstrap complete.");
  })
  .catch((e) => {
    logger.error("🤯🤯🤯 Error during bootstrap!", e);

    fs.writeFileSync(
      `/logs/${timestamp.unix()}-graph.json`,
      PartialGraphHost.toString() ?? "",
    );
    process.exit(1);
  });
