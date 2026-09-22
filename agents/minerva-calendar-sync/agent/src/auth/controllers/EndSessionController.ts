import { Controller, HttpStatus, Inject, Post, Res } from "@nestjs/common";
import { ApiNoContentResponse, ApiOperation } from "@nestjs/swagger";
import type { Response } from "express";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { ACCESS_TOKEN_COOKIE } from "../authConstants";
import { Public } from "../public";
import { sessionCookieOptions } from "../sessionCookie";

@Public()
@Controller({ version: "1" })
export class EndSessionController {
  constructor(@Inject(authConfig.KEY) private readonly auth: AuthConfigType) {}

  @Post("/auth/logout")
  @ApiOperation({
    summary: "Ends the session",
    description:
      "Signs the browser out by clearing the access token cookie; Bearer tokens simply stop being sent.",
    operationId: "EndSession",
    tags: ["Auth"],
  })
  @ApiNoContentResponse({ description: "The session cookie was cleared." })
  @ApiStandardErrorResponses({
    exclude: [
      HttpStatus.BAD_REQUEST,
      HttpStatus.UNAUTHORIZED,
      HttpStatus.NOT_FOUND,
    ],
  })
  async handle(@Res() response: Response): Promise<void> {
    // The same options it was set with: a cookie is only replaced by one
    // with the same name, path and domain.
    response.clearCookie(ACCESS_TOKEN_COOKIE, sessionCookieOptions(this.auth));
    response.status(HttpStatus.NO_CONTENT).end();
  }
}
