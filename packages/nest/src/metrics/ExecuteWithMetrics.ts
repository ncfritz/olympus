import { type RequestMetrics, UNKNOWN } from "@ncfritz/olympus-metrics";
import { createPrometheusRequestMetrics } from "@ncfritz/olympus-metrics/prometheus";
import { Logger } from "@nestjs/common";
import { metricsClientName } from "./MetricsModule";

/** The service a decorated method calls (the `server` and `api` labels). */
export interface ExecuteWithMetricsTarget {
  server: string;
  /** Defaults to `server`. */
  api?: string;
  tag?: string;
}

type HttpResponse = { status?: number; config?: { method?: string } };
type HttpError = {
  response?: HttpResponse;
  request?: unknown;
  config?: { method?: string };
};

const logger = new Logger("ExecuteWithMetrics");

let metrics: RequestMetrics | undefined;
const requestMetrics = () => (metrics ??= createPrometheusRequestMetrics());

/**
 * Records http_client_request_duration_seconds (ADR 0017) for an async
 * method that makes one HTTP call with axios and resolves to its response:
 * `client` is this service (MetricsModule's `app`), `operation` the name
 * given, `method` and `status_code` from the response or error.
 *
 * Without a target, an operation "TMDB.Movie.Details" records server and
 * api "tmdb" and operation "Movie.Details".
 *
 * A call that fails with 404 resolves to `undefined` instead of throwing
 * (see "Not-found handling" in docs/roadmap.md).
 */
export function ExecuteWithMetrics(
  operation: string,
  target?: ExecuteWithMetricsTarget,
) {
  const dot = operation.indexOf(".");
  const server =
    target?.server ??
    (dot > 0 ? operation.slice(0, dot).toLowerCase() : UNKNOWN);
  const name = target || dot < 0 ? operation : operation.slice(dot + 1);
  const api = target?.api ?? server;
  const tag = target?.tag ?? UNKNOWN;

  return function (
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalFunction = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const start = performance.now();
      let response: HttpResponse | undefined;
      let error: HttpError | undefined;

      try {
        response = await originalFunction.apply(this, args);
        return response;
      } catch (e) {
        error = e as HttpError;
        if (error.response?.status === 404) {
          return undefined;
        }
        if (!error.response && error.request) {
          logger.warn(`${operation}: no response received`);
        }
        throw e;
      } finally {
        const answered = response ?? error?.response;
        requestMetrics().observeClientRequest({
          client: metricsClientName(),
          server,
          api,
          tag,
          operation: name,
          method: answered?.config?.method ?? error?.config?.method ?? UNKNOWN,
          statusCode: answered?.status,
          durationSeconds: (performance.now() - start) / 1000,
        });
      }
    };

    return descriptor;
  };
}
