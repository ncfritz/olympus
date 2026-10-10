import { Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { ApiNoContentResponse, ApiOperation } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { Public } from "../public";
import { ConsoleAuthService } from "../services/ConsoleAuthService";

@Public()
@Controller({ version: "1" })
export class EndSessionController {
  constructor(private readonly consoleAuth: ConsoleAuthService) {}

  @Post("/auth/logout")
  @ApiOperation({
    summary: "Ends the session",
    description:
      "Signs the CA console's browser out: ends its Olympus session when its tokens still work, and clears the session cookies either way. Refused to a page that is not the console's. Bearer tokens simply stop being sent.",
    operationId: "EndSession",
    tags: ["Auth"],
  })
  @ApiNoContentResponse({ description: "The session cookies were cleared." })
  @ApiStandardErrorResponses({
    exclude: [
      HttpStatus.BAD_REQUEST,
      HttpStatus.UNAUTHORIZED,
      HttpStatus.NOT_FOUND,
    ],
    include: [HttpStatus.FORBIDDEN, HttpStatus.SERVICE_UNAVAILABLE],
  })
  async handle(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    await this.consoleAuth.logout(request, response);
    response.status(HttpStatus.NO_CONTENT).end();
  }
}
