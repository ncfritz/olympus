import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AllowlistService } from "./allowlist.service";
import { AuthTokenService } from "./auth-token.service";
import { ACCESS_TOKEN_COOKIE } from "./auth.constants";
import { AuthenticatedRequest } from "./auth-user";
import { IS_PUBLIC_KEY } from "./public.decorator";

/**
 * Registered as the global guard (see AuthModule) — every route needs a
 * valid access token unless marked @Public(). The allowlist is re-checked
 * on every request (not just at login), so removing someone from
 * AUTH_ALLOWED_EMAILS takes effect immediately, even for tokens already issued.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AuthTokenService,
    private readonly allowlist: AllowlistService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(req) ?? req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    const email = this.tokens.verifyAccessToken(token);
    if (!this.allowlist.isAllowed(email)) {
      throw new ForbiddenException(`${email} is no longer on the allowlist`);
    }

    req.user = { email };
    return true;
  }
}

function extractBearerToken(req: AuthenticatedRequest): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
}
