import { EmptyResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import * as speakeasy from "speakeasy";
import * as jose from "jose";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlGetContentAuthResponse = {
  dionysus_content_auth_by_pk: {
    key: string;
    key_id: string;
    createdTime: string;
  };
};

@Controller()
export class VerifyAuthCodeController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/content/auth/verify")
  @ApiOperation({
    summary: "Issues a JWT authorizing black curtain access",
    description: "",
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
    type: () => EmptyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("otp") otp: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchOtpKeyRequest = gql`
      query FetchContentAuthBlackCurtainKey {
        dionysus_content_auth_by_pk(key_id: "bc.key") {
          key
          key_id
          createdTime
        }
      }
    `;

    const fetchOtpKeyResponse =
      await this.graphQLClient.request<GraphQlGetContentAuthResponse>(
        fetchOtpKeyRequest,
      );
    const otpKey = fetchOtpKeyResponse.dionysus_content_auth_by_pk.key;
    const verified = speakeasy.totp.verify({
      secret: otpKey,
      encoding: "base32",
      token: otp,
    });

    if (!verified) {
      response.status(HttpStatus.UNAUTHORIZED).end();
      return;
    }

    const fetchJwtKeyRequest = gql`
      query FetchContentAuthJWTKey {
        dionysus_content_auth_by_pk(key_id: "jwt.key") {
          key
          key_id
          createdTime
        }
      }
    `;

    const fetchJwtKeyResponse =
      await this.graphQLClient.request<GraphQlGetContentAuthResponse>(
        fetchJwtKeyRequest,
      );
    const jwtKey = fetchJwtKeyResponse.dionysus_content_auth_by_pk.key;

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
    response.status(HttpStatus.OK).send({ authorized: true });
  }
}
