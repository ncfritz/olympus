import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import Ffmpeg from "fluent-ffmpeg";
import { AppModule } from "./module/AppModule";
Ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH!);
Ffmpeg.setFfprobePath(process.env.FFPROBE_PATH!);

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

bootstrap();
