import {
  applyDecorators,
  type ArgumentsHost,
  type CallHandler,
  Catch,
  type ExceptionFilter,
  type ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  type NestInterceptor,
  SetMetadata,
  UseFilters,
  UseInterceptors,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { from, mergeMap, type Observable } from "rxjs";
import { Public } from "../auth/public";
import { Acme, AcmeProblem } from "./AcmeProblem";
import { AcmeNonceService } from "./services/AcmeNonceService";
import { AcmeUrls } from "./services/AcmeUrls";

export const ACME_ROUTE_KEY = "pkiAcmeRoute";

/** Headers on every ACME answer, success or problem (RFC 8555 §6.5, §7.1). */
const setAcmeHeaders = (
  response: Response,
  nonce: string,
  directory: string,
): void => {
  response.setHeader("Replay-Nonce", nonce);
  response.setHeader("Cache-Control", "no-store");
  response.append("Link", `<${directory}>;rel="index"`);
};

@Injectable()
export class AcmeHeadersInterceptor implements NestInterceptor {
  constructor(
    private readonly nonces: AcmeNonceService,
    private readonly urls: AcmeUrls,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return from(this.nonces.issue()).pipe(
      mergeMap((nonce) => {
        setAcmeHeaders(response, nonce, this.urls.directory());
        return next.handle();
      }),
    );
  }
}

/**
 * Every error under an ACME route as a problem document (RFC 8555 §6.7),
 * with a fresh nonce: a client retries a badNonce with the one it gets.
 */
@Catch()
@Injectable()
export class AcmeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Acme");

  constructor(
    private readonly nonces: AcmeNonceService,
    private readonly urls: AcmeUrls,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const problem = this.toProblem(exception, request);
    try {
      if (!response.getHeader("Replay-Nonce")) {
        setAcmeHeaders(
          response,
          await this.nonces.issue(),
          this.urls.directory(),
        );
      }
    } catch {
      // The database is down: the problem still goes out.
    }
    response
      .status(problem.status)
      .type("application/problem+json")
      .send(JSON.stringify(problem.document()));
  }

  private toProblem(exception: unknown, request: Request): AcmeProblem {
    if (exception instanceof AcmeProblem) return exception;
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const detail = exception.message;
      if (status === 503) {
        return new AcmeProblem("serverInternal", 503, detail);
      }
      if (status === 401 || status === 403) return Acme.unauthorized(detail);
      if (status === 404) {
        return new AcmeProblem(
          "malformed",
          404,
          `No such resource: ${request.path}`,
        );
      }
      if (status < 500) return new AcmeProblem("malformed", status, detail);
    }
    this.logger.error(
      `${request.method} ${request.path} failed: ${exception instanceof Error ? (exception.stack ?? exception.message) : String(exception)}`,
    );
    return Acme.serverInternal("The server failed; it has been logged");
  }
}

/**
 * An ACME resource (ADR 0020, ACME): served on the renewal listener only,
 * outside the management API's document and its access tokens (the
 * request's JWS is its authentication), with ACME's headers and problem
 * documents.
 */
export const AcmeRoute = () =>
  applyDecorators(
    SetMetadata(ACME_ROUTE_KEY, true),
    Public(),
    ApiExcludeController(),
    UseFilters(AcmeExceptionFilter),
    UseInterceptors(AcmeHeadersInterceptor),
  );
