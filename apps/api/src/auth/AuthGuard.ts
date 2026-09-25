import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { authConfig, type AuthConfigType } from "../config/configuration";
import { IS_PUBLIC, REQUIRED_ROLES, REQUIRES_IDENTITY } from "./authDecorators";
import { recordAuthDecision } from "./authMetrics";
import {
  type AuthOutcome,
  type Listener,
  principalName,
  type Principal,
  type RequestWithPrincipal,
} from "./principal";
import { ServiceIdentityService } from "./services/ServiceIdentityService";
import { UserIdentityService } from "./users/UserIdentityService";

/**
 * Authenticates every request (ADR 0018): the services listener from the
 * client certificate, the users listener from the access token (phase 3;
 * until then no user request has credentials).
 *
 * Each listener is in `report` or `enforce` mode. In report mode the
 * request goes through and what would have been rejected is logged and
 * counted, so callers can be moved over one at a time.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly services: ServiceIdentityService,
    private readonly users: UserIdentityService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const listener: Listener = request.listener ?? "users";

    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const { principal, reason } = await this.resolve(request, listener);
    request.principal = principal;

    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES,
      [context.getHandler(), context.getClass()],
    );
    const missingRole =
      principal !== undefined &&
      required !== undefined &&
      required.length > 0 &&
      !required.some((role) => principal.roles.includes(role));

    if (!reason && !missingRole) {
      this.record(request, listener, "allow", principal, undefined);
      return true;
    }

    const failure = reason ?? `needs one of ${required?.join(", ")}`;
    // A route that cannot be served without a principal is enforced whatever
    // mode the listener is in (see RequiresIdentity).
    const enforcing =
      this.auth.modes[listener] === "enforce" ||
      (principal === undefined &&
        this.reflector.getAllAndOverride<boolean>(REQUIRES_IDENTITY, [
          context.getHandler(),
          context.getClass(),
        ]) === true);
    this.record(
      request,
      listener,
      enforcing ? "reject" : "would_reject",
      principal,
      failure,
    );
    if (!enforcing) return true;
    if (missingRole) throw new ForbiddenException();
    throw new UnauthorizedException();
  }

  private async resolve(
    request: RequestWithPrincipal,
    listener: Listener,
  ): Promise<{ principal?: Principal; reason?: string }> {
    if (listener === "services") {
      const identity = this.services.identify(request);
      return "principal" in identity
        ? { principal: identity.principal }
        : { reason: identity.reason };
    }
    const identity = await this.users.identify(request);
    return "principal" in identity
      ? { principal: identity.principal }
      : { reason: identity.reason };
  }

  private record(
    request: RequestWithPrincipal,
    listener: Listener,
    outcome: AuthOutcome,
    principal: Principal | undefined,
    reason: string | undefined,
  ): void {
    recordAuthDecision(listener, outcome, reason);
    if (outcome === "allow") return;
    this.logger.warn(
      `${outcome === "reject" ? "rejected" : "would reject"} ${request.method} ${
        request.originalUrl
      } on the ${listener} listener: ${reason} (${principalName(principal)})`,
    );
  }
}
