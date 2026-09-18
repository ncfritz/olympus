import { CheckAuthResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Req, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response, type Request } from "express";
import { gql, GraphQLClient } from "graphql-request";
import * as jose from "jose";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type FetchJwtQueryInput = Record<string, never>;

type FetchJwtQueryResponse = {
  dionysus_content_auth_by_pk: {
    key: string;
    key_id: string;
    creationTime: string;
  };
};

@Controller({ version: "1" })
export class CheckAuthController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/content/auth/status")
  @ApiOperation({
    summary: "Issues a JWT authorizing black curtain access",
    description: "",
    operationId: "CheckAuthorization",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "If authentication was successful.",
    type: () => CheckAuthResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const cookiejwt = request.cookies["x-dionysus-content-auth"];

    if (!cookiejwt) {
      response.status(HttpStatus.UNAUTHORIZED).send({ authorized: false });
      return;
    }

    const fetchJwtKeyRequest = gql`
      query CheckAuthorization {
        dionysus_content_auth_by_pk(key_id: "jwt.key") {
          key
          key_id
          createdTime
        }
      }
    `;

    const fetchJwtKeyResponse = await this.graphQLClient.request<
      FetchJwtQueryResponse,
      FetchJwtQueryInput
    >(fetchJwtKeyRequest);
    const jwtKey = new TextEncoder().encode(
      fetchJwtKeyResponse.dionysus_content_auth_by_pk.key,
    );

    await jose.jwtVerify(cookiejwt, jwtKey, {
      issuer: "ncfritz.dionysus.content",
      maxTokenAge: "30m",
    });

    const responseBody: CheckAuthResponse = { authorized: true };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
