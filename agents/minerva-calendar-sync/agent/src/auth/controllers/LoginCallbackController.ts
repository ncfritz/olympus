import {
  Controller,
  Get,
  Inject,
  Param,
  Req,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { ACCESS_TOKEN_COOKIE, OIDC_TXN_COOKIE } from "../authConstants";
import { Public } from "../public";
import { sessionCookieOptions } from "../sessionCookie";
import { LoginService } from "../services/LoginService";

const ACCESS_TOKEN_COOKIE_TTL_MS = 60 * 60 * 1000;

/**
 * The OIDC redirect URI ({AUTH_BASE_URL}/auth/callback/{provider}, registered
 * with each provider): unversioned and outside the OpenAPI document.
 */
@ApiExcludeController()
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class LoginCallbackController {
  constructor(
    private readonly login: LoginService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  @Get("/auth/callback/:provider")
  async handle(
    @Param("provider") providerName: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const rawTransaction = request.cookies?.[OIDC_TXN_COOKIE] as
      string | undefined;
    const cookie = sessionCookieOptions(this.auth.webAppUrl, request.secure);
    response.clearCookie(OIDC_TXN_COOKIE, cookie);

    const { accessToken, refreshToken, returnTo } = await this.login.complete(
      providerName,
      rawTransaction,
      request.originalUrl,
    );
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...cookie,
      maxAge: ACCESS_TOKEN_COOKIE_TTL_MS,
    });

    // Browser-based web login: the cookie above is all the console needs —
    // redirect back into it rather than showing raw JSON. Non-browser
    // callers (no returnTo) get the tokens directly, e.g. for Bearer use.
    if (returnTo) {
      response.redirect(returnTo);
      return;
    }
    response.json({ accessToken, refreshToken, tokenType: "Bearer" });
  }
}
