import {
  Controller,
  Get,
  Inject,
  Query,
  Req,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { SIGN_IN_TXN_COOKIE } from "../authConstants";
import { Public } from "../public";
import { sessionCookieOptions, setSessionCookies } from "../sessionCookie";
import { SignInService } from "../services/SignInService";

/**
 * The redirect URI the Olympus API's client registry holds for this console
 * ({AUTH_BASE_URL}/auth/callback, ADR 0029): unversioned and outside the
 * OpenAPI document.
 */
@ApiExcludeController()
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class LoginCallbackController {
  constructor(
    private readonly signIn: SignInService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  @Get("/auth/callback")
  async handle(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const rawTransaction = (
      request.cookies as Record<string, string | undefined> | undefined
    )?.[SIGN_IN_TXN_COOKIE];
    response.clearCookie(SIGN_IN_TXN_COOKIE, sessionCookieOptions(this.auth));

    const { returnTo, ...tokens } = await this.signIn.complete(rawTransaction, {
      code,
      state,
      error,
    });
    setSessionCookies(response, this.auth, tokens);

    // The console: back into it, signed in. A caller with no returnTo gets
    // the access token, for a Bearer header. Not the refresh token: the
    // agent refreshes with it from the cookie, and two holders of one
    // refresh token end its session (ADR 0018).
    if (returnTo) {
      response.redirect(returnTo);
      return;
    }
    response.json({
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      tokenType: "Bearer",
    });
  }
}
