import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class PrometheusMetricsInterceptor implements NestInterceptor {
  constructor() {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    return next.handle().pipe(
      tap({
        finalize: () => {
          if (request && request.path) {
            if (request.path === "/metrics") {
              response.set("content-type", "text/plain");
            }
          }
        },
      }),
    );
  }
}
