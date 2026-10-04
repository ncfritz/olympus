import {
  Controller,
  ForbiddenException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiNoContentResponse, ApiOperation } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { Public } from "../public";
import { mayChangeWithCookies } from "../sameOrigin";
import { clearSessionCookies } from "../sessionCookie";
import { SessionService } from "../services/SessionService";

@Public()
@Controller({ version: "1" })
export class EndSessionController {
  constructor(
    private readonly sessions: SessionService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  @Post("/auth/logout")
  @ApiOperation({
    summary: "Ends the session",
    description:
      "Signs the browser out: ends its Olympus session when its access token still verifies, and clears the session cookies either way. Refused to a page that is not the console's. Bearer tokens simply stop being sent.",
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
  })
  async handle(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (!mayChangeWithCookies(request, this.auth)) {
      throw new ForbiddenException("Signing out must come from the console");
    }
    await this.sessions.end(request);
    clearSessionCookies(response, this.auth);
    response.status(HttpStatus.NO_CONTENT).end();
  }
}
