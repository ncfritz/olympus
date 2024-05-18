import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import { EmptyResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Req, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Response, Request } from "express";
import { gql, GraphQLClient } from "graphql-request";
import * as jose from "jose";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type FetchJwtQueryInput = Record<string, never>;

type FetchJwtQueryResponse = {
  dionysus_content_auth_by_pk: {
    key: string;
    key_id: string;
    creationTime: string;
  };
};

@Controller()
export class CheckAuthController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/content/auth/status")
  @ApiOperation({
    summary: "Issues a JWT authorizing black curtain access",
    description: "",
    operationId: "CheckAuthorization",
  })
  @ApiTags("Content")
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "If authentication was successful.",
    type: () => EmptyResponse,
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

    response.status(HttpStatus.OK).send({ authorized: true });
  }
}
