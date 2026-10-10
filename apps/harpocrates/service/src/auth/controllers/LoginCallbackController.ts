import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../public";
import { ConsoleAuthService } from "../services/ConsoleAuthService";

/**
 * The redirect URI the Olympus API's client registry holds for the CA
 * console ({AUTH_BASE_URL}/auth/callback, ADR 0029): unversioned and
 * outside the OpenAPI document.
 */
@ApiExcludeController()
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class LoginCallbackController {
  constructor(private readonly consoleAuth: ConsoleAuthService) {}

  @Get("/auth/callback")
  async handle(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const answer = await this.consoleAuth.callback(
      { code, state, error },
      request,
      response,
    );
    if ("returnTo" in answer) {
      response.redirect(answer.returnTo);
      return;
    }
    response.json(answer);
  }
}
