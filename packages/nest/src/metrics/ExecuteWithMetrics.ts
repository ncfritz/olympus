import { Logger } from "@nestjs/common";
import { ReporterService } from "nestjs-metrics-reporter";

export type ExecuteWithMetricsOptions = Record<string, never>;

type HttpError = { response?: { status?: number }; request?: unknown };

const logger = new Logger("ExecuteWithMetrics");

/**
 * Records client metrics for an async method that makes an HTTP call and
 * resolves to a response with a `status`:
 *
 * - `client_<operation>_count` and `_latency` (milliseconds)
 * - `client_<operation>_1xx` ... `_5xx`, by the response status
 * - `client_<operation>_error` (4xx), `_fatal` (5xx), `_throttles` (429)
 *   and `_exception` (the call threw)
 *
 * A call that fails with 404 resolves to `undefined` instead of throwing.
 */
export function ExecuteWithMetrics(
  operation: string,
  _options?: ExecuteWithMetricsOptions,
) {
  return function (
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalFunction = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      let response: { status?: number } | undefined;

      const start = Date.now();
      let exception = 0;

      try {
        response = await originalFunction.apply(this, args);
        return response;
      } catch (e) {
        exception = 1;
        const error = e as HttpError;

        if (error.response) {
          if (error.response.status === 404) {
            return undefined;
          }
        } else if (error.request) {
          logger.warn(`${operation}: no response received`);
        }

        throw e;
      } finally {
        const latency = Date.now() - start;
        const status = response?.status ?? 0;
        const inRange = (low: number) =>
          status >= low && status <= low + 99 ? 1 : 0;

        ReporterService.counter(`client_${operation}_count`, {}, 1);
        ReporterService.histogram(`client_${operation}_latency`, latency);
        ReporterService.counter(`client_${operation}_error`, {}, inRange(400));
        ReporterService.counter(`client_${operation}_fatal`, {}, inRange(500));
        ReporterService.counter(`client_${operation}_exception`, {}, exception);
        ReporterService.counter(
          `client_${operation}_throttles`,
          {},
          status === 429 ? 1 : 0,
        );
        ReporterService.counter(`client_${operation}_1xx`, {}, inRange(100));
        ReporterService.counter(`client_${operation}_2xx`, {}, inRange(200));
        ReporterService.counter(`client_${operation}_3xx`, {}, inRange(300));
        ReporterService.counter(`client_${operation}_4xx`, {}, inRange(400));
        ReporterService.counter(`client_${operation}_5xx`, {}, inRange(500));
      }
    };

    return descriptor;
  };
}
