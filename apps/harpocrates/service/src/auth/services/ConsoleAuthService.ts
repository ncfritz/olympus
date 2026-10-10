import {
  ConsoleSession,
  ConsoleSignIn,
  clearSessionCookies,
  mayChangeWithCookies,
  sessionCookieNames,
  sessionCookieOptions,
  setSessionCookies,
} from "@ncfritz/olympus-nest";
import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  authConfig,
  type AuthConfigType,
  type ConsoleSignInConfig,
} from "../../config/configuration";
import type { CurrentUser } from "../../model/auth";
import { COOKIE_PREFIX } from "../consoleSignIn";
import type { Principal } from "../principal";
import { AccessTokenService } from "./AccessTokenService";

/** How long a sign-in may take between leaving for Olympus and coming back. */
const SIGN_IN_TXN_COOKIE_TTL_MS = 5 * 60 * 1000;

/**
 * The CA console's sign-in through Olympus (ADR 0029, 0032): the redirect
 * out, the callback's cookies, who is signed in, and signing out. Without
 * OLYMPUS_API_URL there is no console sign-in, and these refuse with 503;
 * Bearer tokens work either way.
 */
@Injectable()
export class ConsoleAuthService {
  constructor(
    private readonly signIn: ConsoleSignIn,
    private readonly session: ConsoleSession,
    private readonly tokens: AccessTokenService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  /** Starts a sign-in with `provider`: the transaction's cookie, and where to send the browser. */
  async login(
    provider: string,
    returnTo: string | undefined,
    response: Response,
  ): Promise<string> {
    const config = this.consoleConfig();
    const { url, transaction } = await this.signIn.start(provider, returnTo);
    response.cookie(this.cookieNames().signIn, JSON.stringify(transaction), {
      ...sessionCookieOptions(config),
      maxAge: SIGN_IN_TXN_COOKIE_TTL_MS,
    });
    return url;
  }

  /**
   * Completes a sign-in: the session cookies set, and where to send the
   * browser, or, for a caller with nowhere to go, the access token to
   * answer. Never the refresh token: the service refreshes with it from
   * its cookie, and two holders of one refresh token end the session
   * (ADR 0018). @throws BadRequestException
   */
  async callback(
    query: { code?: string; state?: string; error?: string },
    request: Request,
    response: Response,
  ): Promise<
    | { returnTo: string }
    | { accessToken: string; expiresIn: number; tokenType: "Bearer" }
  > {
    const config = this.consoleConfig();
    const name = this.cookieNames().signIn;
    const raw = (
      request.cookies as Record<string, string | undefined> | undefined
    )?.[name];
    response.clearCookie(name, sessionCookieOptions(config));
    const { returnTo, ...tokens } = await this.signIn.complete(raw, query);
    setSessionCookies(response, this.cookieConfig(config), tokens);
    if (returnTo) return { returnTo };
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      tokenType: "Bearer",
    };
  }

  /** Who is signed in: their email from the API, their roles from the token. */
  async currentUser(
    principal: Principal,
    accessToken: string,
  ): Promise<CurrentUser> {
    this.consoleConfig();
    const { email } = await this.session.describe(accessToken);
    return { email, roles: principal.roles };
  }

  /**
   * Signs the browser out: its Olympus session ended when it can be, its
   * cookies cleared either way. Refused to a page that is not the
   * console's. @throws ForbiddenException
   */
  async logout(request: Request, response: Response): Promise<void> {
    const config = this.consoleConfig();
    if (!mayChangeWithCookies(request, config)) {
      throw new ForbiddenException("Signing out must come from the console");
    }
    await this.session.end(request, (token) => this.tokens.check(token));
    clearSessionCookies(response, this.cookieConfig(config));
  }

  private consoleConfig(): ConsoleSignInConfig {
    if (!this.auth.console) {
      throw new ServiceUnavailableException(
        "The console's sign-in is not configured (OLYMPUS_API_URL)",
      );
    }
    return this.auth.console;
  }

  private cookieConfig(config: ConsoleSignInConfig) {
    return { ...config, cookiePrefix: COOKIE_PREFIX };
  }

  private cookieNames() {
    return sessionCookieNames({ cookiePrefix: COOKIE_PREFIX });
  }
}
