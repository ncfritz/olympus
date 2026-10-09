import { identifyPeerCertificate } from "@ncfritz/olympus-nest";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REQUIRED_ROLE,
} from "../authConstants";
import { AuthenticatedRequest } from "../authUser";
import { IS_PUBLIC_KEY } from "../public";
import { mayChangeWithCookies } from "../sameOrigin";
import { SERVICES_ONLY_KEY } from "../servicesOnly";
import { clearSessionCookies, setSessionCookies } from "../sessionCookie";
import {
  type OlympusClaims,
  OlympusTokenVerifier,
} from "../services/OlympusTokenVerifier";
import { SignInService } from "../services/SignInService";

/**
 * Registered as the global guard (see AuthModule) — every route needs an
 * Olympus access token with the admin role unless marked @Public()
 * (ADR 0029). The token is checked with the API's published keys, so a role
 * taken away reaches the agent when the token expires, as it reaches the
 * API.
 *
 * The console's tokens are cookies. When its access token has expired the
 * guard refreshes it with the refresh token cookie and answers with both
 * replaced; a Bearer caller refreshes with the API itself.
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
    private readonly verifier: OlympusTokenVerifier,
    private readonly signIn: SignInService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const bearer = extractBearerToken(req);
    const { accessToken, claims } =
      bearer !== undefined
        ? await this.verifyBearer(bearer)
        : await this.verifyCookies(
            req,
            context.switchToHttp().getResponse<Response>(),
          );

    if (!claims.roles.includes(REQUIRED_ROLE)) {
      throw new ForbiddenException(
        `Olympus user ${claims.userId} does not have the ${REQUIRED_ROLE} role`,
      );
    }
    const servicesOnly = this.reflector.getAllAndOverride<boolean>(
      SERVICES_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (servicesOnly) {
      throw new ForbiddenException("Only the Olympus API may call this");
    }

    req.user = {
      kind: "user",
      userId: claims.userId,
      roles: claims.roles,
      accessToken,
    };
    return true;
  }

  private async verifyBearer(
    token: string,
  ): Promise<{ accessToken: string; claims: OlympusClaims }> {
    const verified = await this.verifier.verify(token);
    if ("reason" in verified) throw refusal(verified);
    return { accessToken: token, claims: verified.claims };
  }

  /**
   * The console's access token cookie, or, when it is gone or no longer
   * good, new tokens for its refresh token cookie. The cookies are cleared
   * only when Olympus says the session has ended; when it cannot be asked,
   * they are left as they are and the request is refused for now.
   */
  private async verifyCookies(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<{ accessToken: string; claims: OlympusClaims }> {
    if (!mayChangeWithCookies(req, this.auth)) {
      throw new ForbiddenException(
        "A change riding on the console's cookies must come from the console",
      );
    }
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;
    const access = cookies?.[ACCESS_TOKEN_COOKIE];
    if (access) {
      const verified = await this.verifier.verify(access);
      if ("claims" in verified) {
        return { accessToken: access, claims: verified.claims };
      }
      if (verified.transient) throw refusal(verified);
    }

    const refresh = cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refresh) {
      throw new UnauthorizedException("Missing access token");
    }
    let tokens;
    try {
      tokens = await this.signIn.refresh(refresh);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        clearSessionCookies(res, this.auth);
      }
      throw error;
    }
    // Kept whatever happens next: the old refresh token is spent.
    setSessionCookies(res, this.auth, tokens);
    const verified = await this.verifier.verify(tokens.accessToken);
    if ("reason" in verified) throw refusal(verified);
    return { accessToken: tokens.accessToken, claims: verified.claims };
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

/** Why a token was not accepted: for now, or for good. */
function refusal(verified: { reason: string; transient: boolean }): Error {
  return verified.transient
    ? new ServiceUnavailableException(
        `Olympus's keys cannot be had just now: ${verified.reason}`,
      )
    : new UnauthorizedException(`Invalid access token: ${verified.reason}`);
}

function extractBearerToken(req: AuthenticatedRequest): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
}
