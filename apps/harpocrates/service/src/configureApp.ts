import {
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { operationsFromOpenApi } from "@ncfritz/olympus-metrics";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { useHttpServerMetrics } from "@ncfritz/olympus-nest";
import { serverConfig, type ServerConfigType } from "./config/configuration";
import { API_NAME, buildOpenApiDocument } from "./openapi/documentBuilder";

/**
 * Express-level setup shared by main.ts, the OpenAPI generator and the e2e
 * tests: request metrics, URI versioning (/v1/...), cookies and request
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
  // JSON, and ACME's requests: JWS, as application/jose+json (RFC 8555
  // §6.2). This replaces the default JSON parser, so it names both.
  (app as NestExpressApplication).useBodyParser("json", {
    type: ["application/json", "application/jose+json"],
  });
  // An OCSP request, POSTed as DER (ADR 0036; RFC 6960 A.1).
  (app as NestExpressApplication).useBodyParser("raw", {
    type: "application/ocsp-request",
    limit: "16kb",
  });
  // The CA console's session rides on cookies (ADR 0029, 0032).
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
