import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import type { AuthenticatedRequest, PkiRole } from "../principal";
import { IS_PUBLIC_KEY } from "../public";
import { RECENT_SIGN_IN_KEY, ROLES_KEY } from "../roles";
import { AccessTokenService } from "../services/AccessTokenService";

/**
 * The global guard: every route needs an access token with one of the
 * roles it declares, unless @Public(). A route that declares no roles is
 * refused, so a new route is closed until someone decides who may call it.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokenService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("No access token");
    }
    const principal = await this.tokens.verify(header.slice("Bearer ".length));
    if (!principal) throw new UnauthorizedException("Invalid access token");

    const allowed = this.reflector.getAllAndOverride<PkiRole[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (!allowed?.some((role) => principal.roles.includes(role))) {
      throw new ForbiddenException("Your roles do not allow this");
    }
    if (
      this.reflector.getAllAndOverride<boolean>(RECENT_SIGN_IN_KEY, targets) &&
      Date.now() / 1000 - principal.authTime > this.auth.recentSignInSeconds
    ) {
      throw new ForbiddenException("This needs a recent sign-in");
    }
    request.principal = principal;
    return true;
  }
}
