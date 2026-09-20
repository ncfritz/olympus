import {
  CLIENT_HEADER,
  clientLabel,
  createOperationLookup,
  type OperationEntry,
  type OperationLookup,
  type RequestMetrics,
} from "@ncfritz/olympus-metrics";
import { createPrometheusRequestMetrics } from "@ncfritz/olympus-metrics/prometheus";
import type { INestApplication } from "@nestjs/common";

export interface HttpServerMetricsOptions {
  /** The service's name: the `server` label. */
  server: string;
  /**
   * The operations served, usually operationsFromOpenApi() over the
   * service's OpenAPI documents. Called once, on the first request, when
   * the application is fully initialized.
   */
  operations: () => readonly OperationEntry[];
  /** A prefix the documents' paths omit, such as the API's "/v1". */
  stripPrefix?: string;
  /** Where to record (default: prom-client's default registry). */
  metrics?: RequestMetrics;
}

/** The parts of Express's request and response the middleware reads. */
interface PlainRequest {
  method: string;
  originalUrl: string;
  headers: Record<string, string | string[] | undefined>;
  route?: { path?: unknown };
}
interface PlainResponse {
  statusCode: number;
  writableFinished: boolean;
  on(event: "finish" | "close", listener: () => void): unknown;
}

/**
 * Express middleware recording http_server_request_duration_seconds for
 * every request that matches an operation of `operations` (ADR 0017):
 * `client` from the X-Olympus-Client header, the operation's document, tag
 * and operationId. Requests to anything else (/metrics, provider callbacks,
 * unknown paths) are not recorded. Runs before guards, so rejected requests
 * count too.
 */
export const httpServerMetrics = (options: HttpServerMetricsOptions) => {
  const metrics = options.metrics ?? createPrometheusRequestMetrics();
  let lookup: OperationLookup | undefined;

  return (request: PlainRequest, response: PlainResponse, next: () => void) => {
    const start = performance.now();
    let recorded = false;

    const record = (statusCode: number | undefined) => {
      if (recorded) return;
      recorded = true;
      lookup ??= createOperationLookup(options.operations(), {
        stripPrefix: options.stripPrefix,
      });
      const routePath = request.route?.path;
      const operation = lookup(
        request.method,
        typeof routePath === "string" ? routePath : request.originalUrl,
      );
      if (!operation) return;
      metrics.observeServerRequest({
        client: clientLabel(request.headers[CLIENT_HEADER]),
        server: options.server,
        api: operation.api,
        tag: operation.tag,
        operation: operation.operationId,
        method: request.method,
        statusCode,
        durationSeconds: (performance.now() - start) / 1000,
      });
    };

    response.on("finish", () => record(response.statusCode));
    // Closed before the response finished: the caller went away.
    response.on("close", () =>
      record(response.writableFinished ? response.statusCode : undefined),
    );
    next();
  };
};

/** Installs httpServerMetrics() on `app`; call before app.init(), ahead of other middleware. */
export const useHttpServerMetrics = (
  app: INestApplication,
  options: HttpServerMetricsOptions,
): void => {
  app.use(httpServerMetrics(options));
};
