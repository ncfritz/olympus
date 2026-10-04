import { identifyPeerCertificate } from "@ncfritz/olympus-nest";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AllowlistService } from "../services/AllowlistService";
import { AuthTokenService } from "../services/AuthTokenService";
import { ACCESS_TOKEN_COOKIE } from "../authConstants";
import { AuthenticatedRequest } from "../authUser";
import { IS_PUBLIC_KEY } from "../public";
import { authConfig, type AuthConfigType } from "../../config/configuration";

/**
 * Registered as the global guard (see AuthModule) — every route needs a
 * valid access token unless marked @Public(). The allowlist is re-checked
 * on every request (not just at login), so removing someone from
 * AUTH_ALLOWED_EMAILS takes effect immediately, even for tokens already issued.
 *
 * On the services listener the caller is its client certificate instead
 * (ADR 0028): verified by the handshake, from the expected issuer, and one
 * of AUTH_SERVICE_CLIENTS. No token is read there, and no certificate is
 * read on the HTTP listener.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AuthTokenService,
    private readonly allowlist: AllowlistService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (req.listener === "services") {
      this.authenticateService(req);
      return true;
    }

    const token = extractBearerToken(req) ?? req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    const email = this.tokens.verifyAccessToken(token);
    if (!this.allowlist.isAllowed(email)) {
      throw new ForbiddenException(`${email} is no longer on the allowlist`);
    }

    req.user = { kind: "user", email };
    return true;
  }

  private authenticateService(req: AuthenticatedRequest): void {
    const services = this.auth.services;
    const peer = identifyPeerCertificate(req.socket, services?.issuer);
    if ("reason" in peer) {
      throw new UnauthorizedException(peer.reason);
    }
    if (!services?.clients.includes(peer.name)) {
      throw new ForbiddenException(`${peer.name} may not call this agent`);
    }
    req.user = { kind: "service", name: peer.name };
  }
}

function extractBearerToken(req: AuthenticatedRequest): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
}
