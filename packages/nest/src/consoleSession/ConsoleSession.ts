import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { CONSOLE_SESSION_CONFIG, type ConsoleSessionConfig } from "./config";
import {
  clearSessionCookies,
  sessionCookieNames,
  type SessionTokens,
  setSessionCookies,
} from "./cookies";
import { ConsoleSignIn } from "./ConsoleSignIn";
import { OlympusAuthApi } from "./OlympusAuthApi";
import { mayChangeWithCookies } from "./sameOrigin";

/**
 * What a service's own check of an access token says: its claims, or why
 * not, and whether that is for now (the keys could not be had) or for
 * good. Each service checks for what it needs (roles, `auth_time`).
 */
export type TokenCheck<T> =
  { claims: T } | { reason: string; transient: boolean };

/** Why a token was not accepted: for now, or for good. */
export const tokenRefusal = (verified: {
  reason: string;
  transient: boolean;
}): Error =>
  verified.transient
    ? new ServiceUnavailableException(
        `Olympus's keys cannot be had just now: ${verified.reason}`,
      )
    : new UnauthorizedException(`Invalid access token: ${verified.reason}`);

/** The Bearer token of a request, if it has one. */
export const bearerToken = (
  req: Pick<Request, "headers">,
): string | undefined => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
};

/**
 * The console's access token cookie, or, when it is gone or no longer
 * good, new tokens for its refresh token cookie, set on the response.
 * The cookies are cleared only when Olympus says the session has ended;
 * when it cannot be asked, they are left as they are and the request is
 * refused for now. A change that rides on the cookies must come from the
 * console itself.
 *
 * A plain function of what it needs, so a service's guard can call it
 * with its own refresh and check; ConsoleSession.fromCookies is the same
 * with the module's.
 */
export const sessionFromCookies = async <T>(
  req: Pick<Request, "method" | "headers" | "cookies">,
  res: Pick<Response, "cookie" | "clearCookie">,
  using: {
    config: Pick<
      ConsoleSessionConfig,
      "cookiePrefix" | "baseUrl" | "webAppUrl"
    >;
    refresh: (refreshToken: string) => Promise<SessionTokens>;
    verify: (token: string) => Promise<TokenCheck<T>>;
  },
): Promise<{ accessToken: string; claims: T }> => {
  const { config, refresh, verify } = using;
  if (!mayChangeWithCookies(req, config)) {
    throw new ForbiddenException(
      "A change riding on the console's cookies must come from the console",
    );
  }
  const names = sessionCookieNames(config);
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const access = cookies?.[names.access];
  if (access) {
    const verified = await verify(access);
    if ("claims" in verified) {
      return { accessToken: access, claims: verified.claims };
    }
    if (verified.transient) throw tokenRefusal(verified);
  }

  const refreshToken = cookies?.[names.refresh];
  if (!refreshToken) {
    throw new UnauthorizedException("Missing access token");
  }
  let tokens;
  try {
    tokens = await refresh(refreshToken);
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      clearSessionCookies(res as Response, config);
    }
    throw error;
  }
  // Kept whatever happens next: the old refresh token is spent.
  setSessionCookies(res as Response, config, tokens);
  const verified = await verify(tokens.accessToken);
  if ("reason" in verified) throw tokenRefusal(verified);
  return { accessToken: tokens.accessToken, claims: verified.claims };
};

/**
 * The console's browser session (ADR 0029), as the service behind it takes
 * part: the access token from its cookie, refreshed when it has expired;
 * who the user is; and the end of the session.
 */
@Injectable()
export class ConsoleSession {
  private readonly logger = new Logger(ConsoleSession.name);

  constructor(
    private readonly api: OlympusAuthApi,
    private readonly signIn: ConsoleSignIn,
    @Inject(CONSOLE_SESSION_CONFIG)
    private readonly config: ConsoleSessionConfig,
  ) {}

  /** The session from the cookies: see sessionFromCookies. */
  fromCookies<T>(
    req: Request,
    res: Response,
    verify: (token: string) => Promise<TokenCheck<T>>,
  ): Promise<{ accessToken: string; claims: T }> {
    return sessionFromCookies(req, res, {
      config: this.config,
      refresh: (token) => this.signIn.refresh(token),
      verify,
    });
  }

  /**
   * Who the user is, from the API: the token carries an ID and roles, and
   * the console shows an email. @throws UnauthorizedException when the API
   * no longer knows them, ServiceUnavailableException when it cannot say
   */
  async describe(accessToken: string): Promise<{ email: string }> {
    let answer;
    try {
      answer = await this.api.describeUser(accessToken);
    } catch (error) {
      throw new ServiceUnavailableException(
        "The Olympus API cannot be reached",
        {
          cause: error,
        },
      );
    }
    const described = (
      answer.body as { user?: { email?: unknown } } | undefined
    )?.user;
    if (answer.status === 401) {
      throw new UnauthorizedException("Olympus no longer knows this user");
    }
    if (answer.status !== 200 || typeof described?.email !== "string") {
      throw new ServiceUnavailableException(
        `The Olympus API answered ${answer.status} for the current user`,
      );
    }
    return { email: described.email };
  }

  /**
   * Ends the browser's Olympus session, so signing out of the console is
   * not undone by its refresh token. Best effort: the caller clears the
   * cookies whatever the API says, and an access token already issued
   * lives out its minutes (ADR 0018).
   */
  async end(
    request: Request,
    verify: (token: string) => Promise<TokenCheck<unknown>>,
  ): Promise<void> {
    const names = sessionCookieNames(this.config);
    const cookies = request.cookies as
      Record<string, string | undefined> | undefined;
    try {
      let token = cookies?.[names.access];
      if (token && "reason" in (await verify(token))) {
        token = undefined;
      }
      const refresh = cookies?.[names.refresh];
      if (!token && refresh) {
        token = (await this.signIn.refresh(refresh)).accessToken;
      }
      if (!token) return;
      const answer = await this.api.signOut(token);
      if (answer.status !== 200) {
        this.logger.warn(`signing out answered ${answer.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `could not end the Olympus session: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
