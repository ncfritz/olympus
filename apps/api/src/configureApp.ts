import { INestApplication, VersioningType } from "@nestjs/common";
import * as bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { operationsFromOpenApi } from "@ncfritz/olympus-metrics";
import type { TLSSocket } from "tls";
import { useHttpServerMetrics } from "@ncfritz/olympus-nest";
import { buildOpenApiDocument } from "./schema/documentBuilder";
import { API_DOCUMENTS } from "./schema/schemas";
import { serverConfig, ServerConfigType } from "./config/configuration";

/**
 * Express-level setup shared by the server (main.ts) and the API tests:
 * request metrics, middleware, CORS and URI versioning. Interceptors, guards and pipes are
 * providers (APP_INTERCEPTOR, ... in AppModule, or on the route), so the
 * tests get them from the module graph.
 */
export const configureApp = (app: INestApplication): INestApplication => {
  const server = app.get<ServerConfigType>(serverConfig.KEY);
  // First, so every request is timed (ADR 0017). The operations come from
  // the API documents, built once on the first request.
  useHttpServerMetrics(app, {
    server: server.appName,
    // On the services listener the caller is its certificate, not a header.
    client: (request) => {
      const socket = (request as { socket?: TLSSocket }).socket;
      if (typeof socket?.getPeerCertificate !== "function") return undefined;
      const name = socket.getPeerCertificate()?.subject?.CN;
      return Array.isArray(name) ? name[0] : name;
    },
    operations: () =>
      API_DOCUMENTS.flatMap((config) =>
        operationsFromOpenApi(
          config.name.toLowerCase(),
          buildOpenApiDocument(app, config, false),
        ),
      ),
  });
  app.use(cookieParser());
  // Allow larger body size
  app.use(bodyParser.json({ limit: 1024 * 1024 * 10, inflate: true }));
  app.use(bodyParser.urlencoded({ limit: 1024 * 1024 * 200, extended: true }));
  app.enableCors({
    origin: server.corsOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  });
  app.enableVersioning({
    type: VersioningType.URI,
  });
  return app;
};
