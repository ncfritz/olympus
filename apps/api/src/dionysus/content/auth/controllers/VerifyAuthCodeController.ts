import { VerifyAuthResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { CONTENT_AUTH_COOKIE } from "../contentAuth";
import { ContentAuthService } from "../services/ContentAuthService";

@Controller({ version: "1" })
export class VerifyAuthCodeController {
  constructor(private readonly contentAuth: ContentAuthService) {}

  @Get("/content/auth/verify")
  @ApiOperation({
    summary: "Verifies a one-time code and grants black curtain access",
    description:
      "Verifies the TOTP code and, if it is valid, sets a 15-minute x-dionysus-content-auth cookie that authorizes black curtain access.",
    operationId: "VerifyAuthCode",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "otp",
    description: "The one-time-password to verify",
    type: String,
  })
  @ApiOkResponse({
    description: "If authentication was successful.",
    type: () => VerifyAuthResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("otp") otp: string,
    @Res() response: Response,
  ): Promise<void> {
    const jwt = await this.contentAuth.verifyCode(otp);

    response.cookie(CONTENT_AUTH_COOKIE, jwt, {
      secure: true,
      sameSite: "strict",
      httpOnly: false,
      maxAge: 15 * 60 * 1000,
    });

    const responseBody: VerifyAuthResponse = { authorized: true };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
