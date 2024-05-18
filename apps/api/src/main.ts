import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import * as bodyParser from "body-parser";
import { AppModule } from "./module/AppModule";

async function bootstrap() {
  const enableApiExplorer =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_API_EXPLORER === "true";

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  // Allow larger body size
  app.use(bodyParser.json({ limit: "2mb" }));
  app.use(bodyParser.urlencoded({ limit: "2mb", extended: true }));
  app.enableCors({
    origin: ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  });

  if (enableApiExplorer) {
    const config = new DocumentBuilder()
      .setTitle("dionysus-api")
      .setDescription("Dionysus API")
      .setVersion("1.0")
      .setContact("Neil Fritz", "https://ncfritz.net", "ncfritz@ncfritz.net")
      .addTag("Dionysus")
      .build();
    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup("/api-spec", app, document);
  }

  await app.listen(3001);
}

bootstrap().then(() => {
  console.log("🔥🔥🔥 Olympus API bootstrap complete.");
});
