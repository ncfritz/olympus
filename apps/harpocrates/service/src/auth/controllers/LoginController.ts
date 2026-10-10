import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../public";
import { ConsoleAuthService } from "../services/ConsoleAuthService";

/**
 * Starts the CA console's sign-in: redirects the browser to the Olympus
 * API's sign-in with the identity provider it names (ADR 0029, 0032).
 * Unversioned and outside the OpenAPI document: a redirect, not a JSON
 * operation.
 */
@ApiExcludeController()
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class LoginController {
  constructor(private readonly consoleAuth: ConsoleAuthService) {}

  @Get("/auth/login/:provider")
  async handle(
    @Param("provider") provider: string,
    @Query("returnTo") returnTo: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(
      await this.consoleAuth.login(provider, returnTo, response),
    );
  }
}
