import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { bearerToken, ConsoleSession } from "@ncfritz/olympus-nest";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { ACME_ROUTE_KEY } from "../../acme/acmeRoute";
import {
  CLIENT_CERTIFICATE_KEY,
  listenerOf,
  RENEWAL_PUBLISHED_KEY,
  SIGNED_RENEWAL_KEY,
} from "../clientCertificate";
import type { AuthenticatedRequest, PkiRole, Principal } from "../principal";
import { IS_PUBLIC_KEY } from "../public";
import { RECENT_SIGN_IN_KEY, ROLES_KEY, SIGNED_IN_KEY } from "../roles";
import { AccessTokenService } from "../services/AccessTokenService";

/**
 * The global guard: every route needs an access token with one of the
 * roles it declares, unless @Public(). A route that declares no roles is
 * refused, so a new route is closed until someone decides who may call it;
 * @SignedIn() takes anyone signed in.
 *
 * The token is a Bearer header, or, for the CA console, its cookie,
 * refreshed when it has expired (ADR 0029, 0032).
 *
 * The renewal listener serves only @ClientCertificate(), @AcmeRoute(),
 * @SignedRenewal() and @RenewalPublished() routes, and they are served
 * nowhere else: anything else is a 404 there, and they are one on the
 * management listener.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokenService,
    private readonly session: ConsoleSession,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    // The renewal listener's routes: renewal by client certificate, ACME,
    // whose requests authenticate themselves (a JWS), SSH hosts'
    // renewal, signed by the host key, and what hosts fetch over HTTPS.
    const renewalRoute = Boolean(
      this.reflector.getAllAndOverride<boolean>(
        CLIENT_CERTIFICATE_KEY,
        targets,
      ) ||
      this.reflector.getAllAndOverride<boolean>(ACME_ROUTE_KEY, targets) ||
      this.reflector.getAllAndOverride<boolean>(SIGNED_RENEWAL_KEY, targets) ||
      this.reflector.getAllAndOverride<boolean>(RENEWAL_PUBLISHED_KEY, targets),
    );
    const onRenewal =
      listenerOf(context.switchToHttp().getRequest<AuthenticatedRequest>()) ===
      "renewal";
    if (renewalRoute !== onRenewal) throw new NotFoundException();
    if (renewalRoute) return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { principal, accessToken } = await this.authenticate(
      request,
      context.switchToHttp().getResponse<Response>(),
    );

    const signedIn = this.reflector.getAllAndOverride<boolean>(
      SIGNED_IN_KEY,
      targets,
    );
    const allowed = this.reflector.getAllAndOverride<PkiRole[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (!signedIn && !allowed?.some((role) => principal.roles.includes(role))) {
      throw new ForbiddenException("Your roles do not allow this");
    }
    if (
      this.reflector.getAllAndOverride<boolean>(RECENT_SIGN_IN_KEY, targets) &&
      Date.now() / 1000 - principal.authTime > this.auth.recentSignInSeconds
    ) {
      throw new ForbiddenException("This needs a recent sign-in");
    }
    request.principal = principal;
    request.accessToken = accessToken;
    return true;
  }

  /** The principal from a Bearer token, or from the console's cookies. */
  private async authenticate(
    request: AuthenticatedRequest,
    response: Response,
  ): Promise<{ principal: Principal; accessToken: string }> {
    const bearer = bearerToken(request);
    if (bearer !== undefined) {
      const principal = await this.tokens.verify(bearer);
      if (!principal) throw new UnauthorizedException("Invalid access token");
      return { principal, accessToken: bearer };
    }
    if (!this.auth.console) {
      throw new UnauthorizedException("No access token");
    }
    const { accessToken, claims } = await this.session.fromCookies(
      request,
      response,
      (token) => this.tokens.check(token),
    );
    return { principal: claims, accessToken };
  }
}
