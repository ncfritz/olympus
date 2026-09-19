import { INestApplication, VersioningType } from "@nestjs/common";
import * as bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { serverConfig, ServerConfigType } from "./config/configuration";

/**
 * Express-level setup shared by the server (main.ts) and the API tests:
 * middleware, CORS and URI versioning. Interceptors, guards and pipes are
 * providers (APP_INTERCEPTOR, ... in AppModule, or on the route), so the
 * tests get them from the module graph.
 */
export const configureApp = (app: INestApplication): INestApplication => {
  const server = app.get<ServerConfigType>(serverConfig.KEY);
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
