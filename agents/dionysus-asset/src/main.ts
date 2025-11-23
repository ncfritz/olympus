import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import Ffmpeg from "fluent-ffmpeg";
import { AppModule } from "./module/AppModule";
Ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH!);
Ffmpeg.setFfprobePath(process.env.FFPROBE_PATH!);

async function bootstrap() {
  //process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  app.enableCors({
    origin: ["http://localhost:3000", "https://dionysus.dev.ncfritz.net"],
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  });

  await app.listen(3102);
}

bootstrap();
