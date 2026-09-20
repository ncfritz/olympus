import {
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { operationsFromOpenApi } from "@ncfritz/olympus-metrics";
import { useHttpServerMetrics } from "@ncfritz/olympus-nest";
import cookieParser from "cookie-parser";
import { serverConfig, type ServerConfigType } from "./config/configuration";
import { API_NAME, buildOpenApiDocument } from "./openapi/documentBuilder";

/**
 * Express-level setup shared by main.ts, the OpenAPI generator and the e2e
 * tests: request metrics, URI versioning (/v1/...), cookies, and request
 * validation.
 */
export const configureApp = (app: INestApplication): INestApplication => {
  const server = app.get<ServerConfigType>(serverConfig.KEY);
  // First, so every request is timed (ADR 0017). The operations come from
  // the management API's document, built once on the first request.
  useHttpServerMetrics(app, {
    server: server.appName,
    operations: () =>
      operationsFromOpenApi(API_NAME, buildOpenApiDocument(app, false)),
  });
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
