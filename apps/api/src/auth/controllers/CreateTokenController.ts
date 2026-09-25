import { publishedUrl } from "@ncfritz/olympus-nest";
import { CreateTokenResponse } from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { Public } from "../authDecorators";
import { resolveClients } from "../clients/clients";
import { AuthorizationCodeService } from "../codes/AuthorizationCodeService";
import { SigningKeyService } from "../tokens/SigningKeyService";
import { ACCESS_TOKEN_SECONDS, issueAccessToken } from "../tokens/accessTokens";
import { newRefreshToken } from "../tokens/refreshTokens";
import { UserDirectoryService } from "../users/UserDirectoryService";

/** The cookie the site's refresh token lives in. */
const REFRESH_COOKIE = "olympus_refresh";

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
  async handle(
    @Body()
    body: Record<string, unknown>,
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
    if (grantType !== "authorization_code") {
      fail(
        "unsupported_grant_type",
        "this endpoint supports authorization_code",
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

    const accessToken = await issueAccessToken(keys, {
      sub: current.user.id,
      clientId,
      roles: current.user.roles,
      // The session's creation, not now: refresh carries it unchanged, so a
      // token can be asked to prove a recent sign-in.
      authTime: Math.floor(new Date(session.createdTime).getTime() / 1000),
    });

    const body_: CreateTokenResponse = {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_SECONDS,
    };

    if (client.refreshToken === "cookie") {
      // Scoped to the auth path, so it is sent to /token and /logout and
      // nowhere else, and httpOnly so no script can read it.
      response.cookie(REFRESH_COOKIE, refresh.token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: this.refreshCookiePath(),
        expires: refresh.expiresAt,
      });
    } else {
      body_.refresh_token = refresh.token;
    }

    this.logger.log(`issued tokens to ${clientId} for session ${session.id}`);
    response.status(HttpStatus.OK).send(body_);
  }

  /**
   * Where the browser sends the refresh cookie. The API is published under
   * a path (`/api`), so the cookie's path has to include it — otherwise the
   * browser never sends the cookie to the endpoint that needs it.
   */
  private refreshCookiePath(): string {
    const base = this.auth.users.publicBaseUrl;
    if (base === undefined) return "/v1/auth";
    return publishedUrl(base, "/v1/auth").pathname;
  }
}
