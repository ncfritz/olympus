import {
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import cookieParser from "cookie-parser";

/**
 * Express-level setup shared by main.ts, the OpenAPI generator and the e2e
 * tests: URI versioning (/v1/...), cookies, and request validation.
 */
export const configureApp = (app: INestApplication): INestApplication => {
  app.enableVersioning({ type: VersioningType.URI });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  return app;
};
