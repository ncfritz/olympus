import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  RefreshAccessTokenRequest,
  RefreshAccessTokenResponse,
} from "../../model/auth";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { Public } from "../public";
import { LoginService } from "../services/LoginService";

@Public()
@Controller({ version: "1" })
export class RefreshAccessTokenController {
  constructor(private readonly login: LoginService) {}

  @Post("/auth/refresh")
  @ApiOperation({
    summary: "Refreshes the access token",
    description:
      "Issues a new access token for a refresh token whose user is still on the allowlist.",
    operationId: "RefreshAccessToken",
    tags: ["Auth"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: RefreshAccessTokenRequest,
    required: true,
    description: "The refresh token.",
  })
  @ApiOkResponse({
    description: "A new access token was issued.",
    type: RefreshAccessTokenResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Body() request: RefreshAccessTokenRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: RefreshAccessTokenResponse = {
      accessToken: await this.login.refresh(request.refreshToken),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
