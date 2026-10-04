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
import { SIGN_IN_TXN_COOKIE } from "../authConstants";
import { Public } from "../public";
import { sessionCookieOptions } from "../sessionCookie";
import { SignInService } from "../services/SignInService";

const SIGN_IN_TXN_COOKIE_TTL_MS = 5 * 60 * 1000;

/**
 * Starts a sign-in: redirects the browser to the Olympus API's sign-in with
 * the identity provider it names (ADR 0029). Unversioned and outside the
 * OpenAPI document: a redirect, not a JSON operation.
 */
@ApiExcludeController()
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class LoginController {
  constructor(
    private readonly signIn: SignInService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  @Get("/auth/login/:provider")
  async handle(
    @Param("provider") provider: string,
    @Query("returnTo") returnTo: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const { url, transaction } = await this.signIn.start(provider, returnTo);
    response.cookie(SIGN_IN_TXN_COOKIE, JSON.stringify(transaction), {
      ...sessionCookieOptions(this.auth),
      maxAge: SIGN_IN_TXN_COOKIE_TTL_MS,
    });
    response.redirect(url);
  }
}
