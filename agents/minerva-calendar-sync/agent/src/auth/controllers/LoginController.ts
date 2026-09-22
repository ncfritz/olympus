import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { OIDC_TXN_COOKIE } from "../authConstants";
import { Public } from "../public";
import { sessionCookieOptions } from "../sessionCookie";
import { LoginService } from "../services/LoginService";

const OIDC_TXN_COOKIE_TTL_MS = 5 * 60 * 1000;

/**
 * Starts a sign-in: redirects the browser to the OIDC provider. Unversioned
 * and outside the OpenAPI document (a redirect, not a JSON operation): its
 * callback is a redirect URI registered with the provider (ADR 0016).
 */
@ApiExcludeController()
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class LoginController {
  constructor(
    private readonly login: LoginService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  @Get("/auth/login/:provider")
  async handle(
    @Param("provider") providerName: string,
    @Query("returnTo") returnTo: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const { authUrl, transaction } = await this.login.start(
      providerName,
      returnTo,
    );
    response.cookie(OIDC_TXN_COOKIE, JSON.stringify(transaction), {
      ...sessionCookieOptions(this.auth.webAppUrl, response.req.secure),
      maxAge: OIDC_TXN_COOKIE_TTL_MS,
    });
    response.redirect(authUrl);
  }
}
