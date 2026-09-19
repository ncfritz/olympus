import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import moment from "moment";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { ReporterService } from "nestjs-metrics-reporter";

@Injectable()
export class PrometheusMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PrometheusMetricsInterceptor.name);

  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const swaggerOperation = this.reflector.get<{ operationId?: string }>(
      "swagger/apiOperation",
      handler,
    );

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();
    const start = moment.now();
    let statusCode = response.statusCode;
    let status1xx = 0;
    let status2xx = 0;
    let status3xx = 0;
    let status4xx = 0;
    let status5xx = 0;
    let error = 0;
    let fatal = 0;

    return next.handle().pipe(
      tap({
        error: (e) => {
          statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

          if (e.status) {
            statusCode = e.status;
          }
        },
        finalize: () => {
          if (swaggerOperation) {
            let operation = swaggerOperation.operationId;

            if (!operation) {
              if (request.path === "/metrics") {
                operation = "GetPrometheusMetrics";
                response.set("content-type", "text/plain");
              } else {
                this.logger.debug(
                  `Skipping metrics, request with no Swagger OperationId encountered - ${request.path}`,
                );
                return;
              }
            }

            if (statusCode >= 100 && statusCode <= 199) {
              status1xx = 1;
            }
            if (statusCode >= 200 && statusCode <= 299) {
              status2xx = 1;
            }
            if (statusCode >= 300 && statusCode <= 399) {
              status3xx = 1;
            }
            if (statusCode >= 400 && statusCode <= 499) {
              status4xx = 1;
              error = 1;
            }

            if (statusCode >= 500 && statusCode <= 599) {
              status5xx = 1;
              fatal = 1;
            }

            const end = moment.now();

            ReporterService.counter(`operation_${operation}_count`, {}, 1);
            ReporterService.histogram(
              `operation_${operation}_latency`,
              end - start,
            );
            ReporterService.counter(`operation_${operation}_error`, {}, error);
            ReporterService.counter(`operation_${operation}_fatal`, {}, fatal);
            ReporterService.counter(
              `operation_${operation}_1xx`,
              {},
              status1xx,
            );
            ReporterService.counter(
              `operation_${operation}_2xx`,
              {},
              status2xx,
            );
            ReporterService.counter(
              `operation_${operation}_3xx`,
              {},
              status3xx,
            );
            ReporterService.counter(
              `operation_${operation}_4xx`,
              {},
              status4xx,
            );
            ReporterService.counter(
              `operation_${operation}_5xx`,
              {},
              status5xx,
            );
          }
        },
      }),
    );
  }
}
