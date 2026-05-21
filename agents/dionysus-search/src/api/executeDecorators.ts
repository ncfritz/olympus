import moment from "moment/moment";
import { ReporterService } from "nestjs-metrics-reporter";
import { logger } from "../util/logger";

export interface ExecuteWithMetricsOptions {}

export function ExecuteWithMetrics(
  operation: string,
  options?: ExecuteWithMetricsOptions,
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalFunction = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let response: any;

      const start = moment.now();
      let error = 0;
      let fatal = 0;
      let exception = 0;
      let status1xx = 0;
      let status2xx = 0;
      let status3xx = 0;
      let status4xx = 0;
      let status5xx = 0;

      try {
        return await originalFunction.apply(this, args);
      } catch (e) {
        exception = 1;

        if (e.response) {
          if (e.response.status === 404) {
            return undefined;
          }
        } else if (e.request) {
          logger.warn("No response received");
        }

        throw e;
      } finally {
        const end = moment.now();

        if (response && response && response.status) {
          const status = response.status;

          if (status >= 100 && status <= 199) {
            status1xx = 1;
          }
          if (status >= 200 && status <= 299) {
            status2xx = 1;
          }
          if (status >= 300 && status <= 399) {
            status3xx = 1;
          }
          if (status >= 400 && status <= 499) {
            status4xx = 1;
            error = 1;
          }
          if (status >= 500 && status <= 599) {
            status5xx = 1;
            fatal = 1;
          }
        }

        ReporterService.counter(`client_${operation}_count`, {}, 1);
        ReporterService.histogram(`client_${operation}_latency`, end - start);
        ReporterService.counter(`client_${operation}_error`, {}, error);
        ReporterService.counter(`client_${operation}_fatal`, {}, fatal);
        ReporterService.counter(`client_${operation}_exception`, {}, exception);
        ReporterService.counter(`client_${operation}_1xx`, {}, status1xx);
        ReporterService.counter(`client_${operation}_2xx`, {}, status2xx);
        ReporterService.counter(`client_${operation}_3xx`, {}, status3xx);
        ReporterService.counter(`client_${operation}_4xx`, {}, status4xx);
        ReporterService.counter(`client_${operation}_5xx`, {}, status5xx);
      }
    };

    return descriptor;
  };
}
