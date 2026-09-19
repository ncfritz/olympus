import { INestApplication, VersioningType } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import * as bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { PrometheusMetricsInterceptor } from "./infra/PrometheusOperationMetricsInterceptor";

/**
 * HTTP pipeline shared by the server (main.ts) and the API tests, so tests
 * exercise the same middleware, versioning and interceptors as production.
 */
export const configureApp = (app: INestApplication): INestApplication => {
  //app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  // Allow larger body size
  app.use(bodyParser.json({ limit: 1024 * 1024 * 10, inflate: true }));
  app.use(bodyParser.urlencoded({ limit: 1024 * 1024 * 200, extended: true }));
  app.enableCors({
    origin: ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  });
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.useGlobalInterceptors(new PrometheusMetricsInterceptor(new Reflector()));
  return app;
};
