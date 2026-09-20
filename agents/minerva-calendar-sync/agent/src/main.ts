import "source-map-support/register";

import { createWinstonLogger } from "@ncfritz/olympus-nest";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { WinstonModule } from "nest-winston";
import { AppModule } from "./AppModule";
import { readConfig } from "./config/configuration";
import { buildOpenApiDocument } from "./openapi";

const logger = new Logger("Bootstrap");

async function bootstrap(): Promise<void> {
  // Fails fast, listing every invalid variable, before anything connects.
  const config = readConfig(process.env);

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      instance: createWinstonLogger(config.logging, config.server.appName),
    }),
  });
  app.enableShutdownHooks();

  if (config.auth.webAppUrl) {
    app.enableCors({ origin: config.auth.webAppUrl, credentials: true });
  }

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const document = buildOpenApiDocument(app, new DocumentBuilder());
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(config.server.port);
}

bootstrap()
  .then(() => {
    logger.log("Minerva calendar sync agent bootstrap complete.");
  })
  .catch((e: unknown) => {
    logger.error(
      "Error during bootstrap!",
      e instanceof Error ? e.stack : String(e),
    );
    process.exit(1);
  });
