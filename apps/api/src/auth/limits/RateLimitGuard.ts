import {
  CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type Request, type Response } from "express";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { recordRateLimited } from "../authMetrics";
import { RATE_LIMIT } from "./rateLimits";
import { type RateLimit, RateLimiter } from "./RateLimiter";

/**
 * Refuses a request that has exceeded the limit on its route.
 *
 * Registered before the authentication guard so that a limit applies to a
 * request the API has not yet spent anything verifying.
 *
 * The answer is a plain 429 with `Retry-After`, including from the token
 * endpoint, which otherwise answers in RFC 6749's shape. RFC 6749 has no
 * error code for this — `invalid_request` would be a lie and `slow_down`
 * belongs to the device grant — and every HTTP client already understands a
 * 429 with `Retry-After`, which is more use to a caller than an OAuth error
 * it would have to special-case.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly limiter = new RateLimiter();

  constructor(
    private readonly reflector: Reflector,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // AUTH_RATE_LIMITS=off, for an environment where the limits are in the
    // way rather than doing their job.
    if (this.auth.rateLimits === "off") return true;

    const limit = this.reflector.getAllAndOverride<RateLimit | undefined>(
      RATE_LIMIT,
      [context.getHandler(), context.getClass()],
    );
    if (limit === undefined) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    // The handler, not the path: `callback/:provider` is one endpoint, and a
    // key per path would let a caller reset its window by varying the
    // parameter. It is also a small fixed set, which a metric label has to
    // be.
    const endpoint = context.getClass().name;
    const decision = this.limiter.check(
      `${endpoint}.${context.getHandler().name}`,
      clientKey(request),
      limit,
    );
    if (decision.allowed) return true;

    recordRateLimited(endpoint, decision.scope);
    this.logger.warn(
      `rate limited ${request.method} ${request.originalUrl} from ${clientKey(
        request,
      )}: over the ${decision.scope} limit`,
    );
    http
      .getResponse<Response>()
      .setHeader("Retry-After", String(decision.retryAfterSeconds));
    throw new HttpException("too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * Who a request is counted against.
 *
 * `request.ip` rather than the socket's address, because express derives it
 * from `X-Forwarded-For` according to the `trust proxy` setting — which is
 * the only correct way to read that header. Whether it can be believed is
 * therefore a deployment question (`TRUSTED_PROXIES`, and nginx actually
 * sending the header) rather than this guard's, and when the answer is no,
 * every request behind the proxy shares one key and the global ceiling is
 * what is doing the work.
 */
const clientKey = (request: Request): string => request.ip ?? "unknown";
