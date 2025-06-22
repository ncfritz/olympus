import { ValidationPipe } from "@nestjs/common";
import { NestFactory, PartialGraphHost } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import * as bodyParser from "body-parser";
import * as fs from "fs";
import { WinstonModule } from "nest-winston";
import { AppModule } from "./module/AppModule";
import { logger } from "./utils/logger";

async function bootstrap() {
  const enableApiExplorer =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_API_EXPLORER === "true";

  const app = await NestFactory.create(AppModule, {
    snapshot: true,
    abortOnError: false,
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  // Allow larger body size
  app.use(bodyParser.json({ limit: 1024 * 1024 * 10, inflate: true }));
  app.use(bodyParser.urlencoded({ limit: 1024 * 1024 * 200, extended: true }));
  app.enableCors({
    origin: ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  });
  app.getHttpServer().setTimeout(2 * 60 * 1000);

  if (enableApiExplorer) {
    const config = new DocumentBuilder()
      .setTitle("olympus-api")
      .setDescription("Olympus API")
      .setVersion("1.0")
      .setContact("Neil Fritz", "https://ncfritz.net", "ncfritz@ncfritz.net")
      .addTag("Dionysus")
      .build();
    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup("/api-spec", app, document);
  }

  await app.listen(process.env.LISTEN_PORT || 3100);
}

bootstrap()
  .then(() => {
    logger.info("🔥🔥🔥 Olympus API bootstrap complete.");
  })
  .catch((e) => {
    logger.error("🤯🤯🤯 Error during bootstrap!", e);
    fs.writeFileSync("graph.json", PartialGraphHost.toString() ?? "");
    process.exit(1);
  });
