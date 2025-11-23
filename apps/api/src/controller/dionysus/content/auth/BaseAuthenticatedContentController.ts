import { FilterDefinition, FilterType } from "@ncfritz/olympus-model";
import { UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { jwtVerify, JWTVerifyOptions } from "jose";
import { createSecretKey } from "node:crypto";

export type GraphQlGetContentAuthResponse = {
  dionysus_content_auth_by_pk: {
    key: string;
    key_id: string;
    createdTime: string;
  };
};

export const BC_FILTER: FilterDefinition = {
  type: FilterType.AND,
  name: "__bc_tag",
  value: [
    {
      type: FilterType.EQUALS,
      name: "asset_tags.tag.type",
      value: "system",
    },
    {
      type: FilterType.LIKE_IGNORE_CASE,
      name: "asset_tags.tag.name",
      value: "bcCompliant",
    },
  ],
};

export abstract class BaseAuthenticatedContentController {
  protected readonly graphQLClient: GraphQLClient;

  protected constructor(graphQLClient: GraphQLClient) {
    this.graphQLClient = graphQLClient;
  }

  async getAuthenticationKey(type: string): Promise<string> {
    const fetchJwtKeyRequest = gql`
      query FetchContentAuthJWTKey {
        dionysus_content_auth_by_pk(key_id: "${type}") {
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

    return fetchJwtKeyResponse.dionysus_content_auth_by_pk.key;
  }

  async authenticateRequest(
    request: Request,
    silent: boolean = false,
  ): Promise<boolean> {
    const token = request.cookies["x-dionysus-content-auth"];

    if (!token) {
      if (!silent) {
        throw new UnauthorizedException();
      }
    }

    const signingKey = createSecretKey(
      await this.getAuthenticationKey("jwt.key"),
      "utf-8",
    );
    const alg = "HS256";
    const options: JWTVerifyOptions = {
      algorithms: [alg],
      issuer: "ncfritz.dionysus.content",
      audience: "test",
    };

    try {
      await jwtVerify(token, signingKey, options);
      return true;
    } catch (e) {
      if (!silent) {
        throw new UnauthorizedException(e);
      }
    }

    return false;
  }
}
