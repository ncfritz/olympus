import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DECORATORS } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ReporterService } from "nestjs-metrics-reporter";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

const STATUS_CLASSES = ["1xx", "2xx", "3xx", "4xx", "5xx"] as const;

/**
 * Per-operation metrics for the management API, as the Olympus API records
 * them (apps/api/src/infra/PrometheusOperationMetricsInterceptor.ts):
 * `operation_<operationId>_count`, `_latency` (ms), `_1xx` ... `_5xx`,
 * `_error` (4xx) and `_fatal` (5xx). Routes without an operationId
 * (provider callbacks) are not recorded. Also serves /metrics as
 * text/plain.
 */
@Injectable()
export class OperationMetricsInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const operationId = this.reflector.get<{ operationId?: string }>(
      DECORATORS.API_OPERATION,
      context.getHandler(),
    )?.operationId;
    const start = Date.now();
    let failedWith: number | undefined;

    return next.handle().pipe(
      tap({
        error: (e: { status?: number }) => {
          failedWith = e.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
        },
        finalize: () => {
          if (request.path === "/metrics") {
            response.set("content-type", "text/plain");
          }
          if (!operationId) return;

          // Controllers answer through @Res(), so the status is known here.
          const status = failedWith ?? response.statusCode;
          const statusClass = Math.floor(status / 100);
          const metric = `operation_${operationId}`;
          ReporterService.counter(`${metric}_count`);
          ReporterService.histogram(`${metric}_latency`, Date.now() - start);
          STATUS_CLASSES.forEach((name, index) =>
            ReporterService.counter(
              `${metric}_${name}`,
              {},
              statusClass === index + 1 ? 1 : 0,
            ),
          );
          ReporterService.counter(
            `${metric}_error`,
            {},
            statusClass === 4 ? 1 : 0,
          );
          ReporterService.counter(
            `${metric}_fatal`,
            {},
            statusClass === 5 ? 1 : 0,
          );
        },
      }),
    );
  }
}
