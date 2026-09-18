import { VerifyAuthResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Query,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { GraphQLClient } from "graphql-request";
import * as speakeasy from "speakeasy";
import * as jose from "jose";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseAuthenticatedContentController } from "./BaseAuthenticatedContentController";

@Controller({ version: "1" })
export class VerifyAuthCodeController extends BaseAuthenticatedContentController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

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
    const otpKey = await this.getAuthenticationKey("bc.key");
    const verified = speakeasy.totp.verify({
      secret: otpKey,
      encoding: "base32",
      token: otp,
    });

    if (!verified) {
      throw new UnauthorizedException();
    }
    const jwtKey = await this.getAuthenticationKey("jwt.key");
    const alg = "HS256";
    const jwt = await new jose.SignJWT({ "urn:example:claim": true })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setIssuer("ncfritz.dionysus.content")
      .setAudience("test")
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(jwtKey));

    response.cookie("x-dionysus-content-auth", jwt, {
      secure: true,
      sameSite: "strict",
      httpOnly: false,
      maxAge: 15 * 60 * 1000,
    });

    const responseBody: VerifyAuthResponse = { authorized: true };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
