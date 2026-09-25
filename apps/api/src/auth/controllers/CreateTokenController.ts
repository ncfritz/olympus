import { CreateTokenResponse } from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { Public } from "../authDecorators";
import { REFRESH_COOKIE, refreshCookieOptions } from "../refreshCookie";
import { AUTH_LIMITS, RateLimited } from "../limits/rateLimits";
import { resolveClients, type RefreshDelivery } from "../clients/clients";
import { AuthorizationCodeService } from "../codes/AuthorizationCodeService";
import { SigningKeyService } from "../tokens/SigningKeyService";
import type { SigningKeys } from "../tokens/signingKeys";
import { ACCESS_TOKEN_SECONDS, issueAccessToken } from "../tokens/accessTokens";
import {
  hashRefreshToken,
  newRefreshToken,
  type NewRefreshToken,
} from "../tokens/refreshTokens";
import { UserDirectoryService } from "../users/UserDirectoryService";

/**
 * Exchanges an authorization code for tokens.
 *
 * The request and the responses follow RFC 6749 rather than this API's own
 * conventions: form-encoded in, snake_case out, and `{ error,
 * error_description }` with a 400 on failure. Every OAuth client library
 * expects that, and an endpoint whose whole purpose is to be spoken to by
 * other people's code is the wrong place to be original.
 *
 * Only `authorization_code` here. `refresh_token` arrives with rotation and
 * reuse detection, which are the same piece of code as the grant itself.
 */
@Controller({ path: "auth", version: "1" })
export class CreateTokenController {
  private readonly logger = new Logger(CreateTokenController.name);

  constructor(
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
    private readonly codes: AuthorizationCodeService,
    private readonly keys: SigningKeyService,
    private readonly users: UserDirectoryService,
  ) {}

  @Post("/token")
  @Public()
  @RateLimited(AUTH_LIMITS.createToken)
  @ApiOperation({
    summary: "Exchanges an authorization code for tokens",
    description:
      "RFC 6749 §4.1.3. Form-encoded, with the PKCE `code_verifier`. The refresh token is returned in the body, except to the site, which receives it in an httpOnly cookie scoped to the auth path so that it never reaches JavaScript.",
    operationId: "CreateToken",
    tags: ["Authentication"],
  })
  @ApiBody({
    required: true,
    schema: {
      type: "object",
      required: [
        "grant_type",
        "code",
        "redirect_uri",
        "client_id",
        "code_verifier",
      ],
      properties: {
        grant_type: { type: "string", enum: ["authorization_code"] },
        code: { type: "string" },
        redirect_uri: { type: "string" },
        client_id: { type: "string" },
        code_verifier: { type: "string" },
        device_name: {
          type: "string",
          description: "Shown in the session list; optional",
        },
      },
    },
  })
  @ApiOkResponse({
    description: "The tokens.",
    type: () => CreateTokenResponse,
  })
  @ApiResponse({
    status: 400,
    description:
      "`{ error, error_description }` per RFC 6749. Which check failed is in the log, not the response.",
  })
  @ApiResponse({
    status: 429,
    description:
      "Over the rate limit; `Retry-After` says for how long. A plain 429 rather than an OAuth error: RFC 6749 has no code for it.",
  })
  async handle(
    @Body()
    body: Record<string, unknown>,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const fail = (error: string, description: string, reason: string): void => {
      this.logger.warn(`token request refused: ${reason}`);
      response.status(HttpStatus.BAD_REQUEST).send({
        error,
        error_description: description,
      });
    };

    const field = (name: string): string | undefined => {
      const value = body[name];
      return typeof value === "string" && value !== "" ? value : undefined;
    };

    const grantType = field("grant_type");
    if (grantType === "refresh_token") {
      await this.refresh(field, request, response, fail);
      return;
    }
    if (grantType !== "authorization_code") {
      fail(
        "unsupported_grant_type",
        "this endpoint supports authorization_code and refresh_token",
        `grant_type was ${grantType ?? "absent"}`,
      );
      return;
    }

    const code = field("code");
    const redirectUri = field("redirect_uri");
    const clientId = field("client_id");
    const verifier = field("code_verifier");
    if (!code || !redirectUri || !clientId || !verifier) {
      fail(
        "invalid_request",
        "code, redirect_uri, client_id and code_verifier are required",
        "a required field was missing",
      );
      return;
    }

    const client = resolveClients(this.auth.users.clientOrigins).get(clientId);
    if (client === undefined) {
      fail("invalid_client", "unknown client", `unknown client ${clientId}`);
      return;
    }

    // Consumes the code whatever happens next: one attempt each.
    const redeemed = this.codes.redeem(code, clientId, redirectUri, verifier);
    if ("reason" in redeemed) {
      // One error for every way this fails. Which one it was would tell a
      // caller whether a code exists, belongs to them, or simply expired.
      fail("invalid_grant", "the code is not valid", redeemed.reason);
      return;
    }

    const keys = this.keys.available();
    if (keys === undefined) {
      fail(
        "temporarily_unavailable",
        "signing in is not configured",
        "AUTH_SIGNING_KEYS is unset",
      );
      return;
    }

    // The roles as they are now, not as they were when the code was issued:
    // a user disabled or re-roled in the meantime is caught here, which is
    // what makes "takes effect at the next refresh" true.
    const current = await this.users.describe(redeemed.code.userId);
    if ("reason" in current) {
      fail("invalid_grant", "the code is not valid", current.reason);
      return;
    }

    const refresh = newRefreshToken();
    const session = await this.users.createSession({
      userId: redeemed.code.userId,
      clientId,
      deviceName: field("device_name"),
      refreshTokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
    });

    await this.issue(response, {
      clientId,
      refreshDelivery: client.refreshToken,
      refresh,
      userId: current.user.id,
      sessionId: session.id,
      roles: current.user.roles,
      // The session's creation, not now: refresh carries it unchanged, so a
      // token can be asked to prove a recent sign-in.
      authTime: Math.floor(new Date(session.createdTime).getTime() / 1000),
      keys,
    });
    this.logger.log(`issued tokens to ${clientId} for session ${session.id}`);
  }

  /**
   * The response both grants send: an access token, and a refresh token
   * wherever this client keeps one. One place, so the two grants cannot
   * drift on the cookie's attributes — which are what stop a script reading
   * it and what decide whether the browser sends it at all.
   */
  private async issue(
    response: Response,
    issued: {
      clientId: string;
      refreshDelivery: RefreshDelivery;
      refresh: NewRefreshToken;
      userId: string;
      sessionId: string;
      roles: string[];
      authTime: number;
      keys: SigningKeys;
    },
  ): Promise<void> {
    const accessToken = await issueAccessToken(issued.keys, {
      sub: issued.userId,
      clientId: issued.clientId,
      sessionId: issued.sessionId,
      roles: issued.roles,
      authTime: issued.authTime,
    });

    const body: CreateTokenResponse = {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_SECONDS,
    };

    if (issued.refreshDelivery === "cookie") {
      // Scoped to the auth path, so it is sent to /token and /logout and
      // nowhere else, and httpOnly so no script can read it.
      response.cookie(REFRESH_COOKIE, issued.refresh.token, {
        ...refreshCookieOptions(this.auth.users.publicBaseUrl),
        expires: issued.refresh.expiresAt,
      });
    } else {
      body.refresh_token = issued.refresh.token;
    }

    response.status(HttpStatus.OK).send(body);
  }

  /**
   * The refresh grant: rotate, or detect a token that has already been
   * rotated away and end the session (ADR 0018).
   */
  private async refresh(
    field: (name: string) => string | undefined,
    request: Request,
    response: Response,
    fail: (error: string, description: string, reason: string) => void,
  ): Promise<void> {
    const clientId = field("client_id");
    const client =
      clientId === undefined
        ? undefined
        : resolveClients(this.auth.users.clientOrigins).get(clientId);
    if (client === undefined || clientId === undefined) {
      fail("invalid_client", "unknown client", `unknown client ${clientId}`);
      return;
    }

    // The site's is in the cookie and never in the body: a refresh token in
    // a form field is one a script could have read.
    const presented =
      client.refreshToken === "cookie"
        ? (request.cookies as Record<string, string> | undefined)?.[
            REFRESH_COOKIE
          ]
        : field("refresh_token");
    if (presented === undefined || presented === "") {
      fail("invalid_request", "a refresh token is required", "none presented");
      return;
    }

    const hash = hashRefreshToken(presented);
    const found = await this.users.findSessionByRefreshToken(hash);
    if (found === undefined) {
      fail("invalid_grant", "the refresh token is not valid", "unknown token");
      return;
    }

    if (found.matched === "previous") {
      // Already rotated away. Either someone is replaying a stolen token, or
      // the real client raced itself — and we cannot tell which, so the
      // session ends. ADR 0018 chose this deliberately: two simultaneous
      // refreshes will sign someone out, which is the price of detecting a
      // theft at all.
      await this.users.revokeSession(found.session.id);
      this.logger.warn(
        `refresh token reused: session ${found.session.id} revoked`,
      );
      fail(
        "invalid_grant",
        "the refresh token is not valid",
        "a rotated token was presented again",
      );
      return;
    }

    const session = found.session;
    if (session.revokedTime !== null) {
      fail(
        "invalid_grant",
        "the refresh token is not valid",
        "session revoked",
      );
      return;
    }
    if (new Date(session.expiresTime).getTime() <= Date.now()) {
      fail(
        "invalid_grant",
        "the refresh token is not valid",
        "session expired",
      );
      return;
    }
    if (session.clientId !== clientId) {
      // A token issued to one client being used by another.
      fail(
        "invalid_grant",
        "the refresh token is not valid",
        `session belongs to ${session.clientId}`,
      );
      return;
    }

    const keys = this.keys.available();
    if (keys === undefined) {
      fail(
        "temporarily_unavailable",
        "signing in is not configured",
        "AUTH_SIGNING_KEYS is unset",
      );
      return;
    }

    const current = await this.users.describe(session.userId);
    if ("reason" in current) {
      // A disabled user's session stops working here rather than at expiry.
      await this.users.revokeSession(session.id);
      fail("invalid_grant", "the refresh token is not valid", current.reason);
      return;
    }

    const next = newRefreshToken();
    if (!(await this.users.rotateSession(session.id, hash, next.hash))) {
      // Someone else rotated it between the lookup and the update.
      fail(
        "invalid_grant",
        "the refresh token is not valid",
        "the token was rotated concurrently",
      );
      return;
    }

    await this.issue(response, {
      clientId,
      refreshDelivery: client.refreshToken,
      refresh: next,
      userId: current.user.id,
      // The same session across a rotation: rotating the token does not
      // start a new one, which is what makes the session list stable.
      sessionId: session.id,
      roles: current.user.roles,
      // Unchanged across refresh, so a recent-sign-in requirement means
      // signing in again rather than refreshing again.
      authTime: Math.floor(new Date(session.createdTime).getTime() / 1000),
      keys,
    });
    this.logger.log(`refreshed session ${session.id} for ${clientId}`);
  }
}
