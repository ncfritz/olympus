import { Controller, HttpStatus, Post, Res } from "@nestjs/common";
import { ApiNoContentResponse, ApiOperation } from "@nestjs/swagger";
import type { Response } from "express";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { ACCESS_TOKEN_COOKIE } from "../authConstants";
import { Public } from "../public";

@Public()
@Controller({ version: "1" })
export class EndSessionController {
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
    response.clearCookie(ACCESS_TOKEN_COOKIE);
    response.status(HttpStatus.NO_CONTENT).end();
  }
}
