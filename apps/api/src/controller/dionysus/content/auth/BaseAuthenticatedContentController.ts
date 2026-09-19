import { FilterDefinition, FilterType } from "@ncfritz/olympus-model";
import {
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { jwtVerify, JWTVerifyOptions } from "jose";
import { createSecretKey } from "node:crypto";

export type GraphQlGetContentAuthResponse = {
  dionysus_content_auth_by_pk: {
    key: string;
    key_id: string;
    createdTime: string;
  } | null;
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

/** Channels a request without content auth may see. */
export const BC_CHANNEL_FILTER: FilterDefinition = {
  type: FilterType.EQUALS,
  name: "bcCompliant",
  value: true,
};

export const getContentAuthKey = async (
  graphQLClient: GraphQLClient,
  type: string,
): Promise<string> => {
  const fetchKeyRequest = gql`
    query FetchContentAuthKey($keyId: String!) {
      dionysus_content_auth_by_pk(key_id: $keyId) {
        key
        key_id
        createdTime
      }
    }
  `;

  const fetchKeyResponse =
    await graphQLClient.request<GraphQlGetContentAuthResponse>(
      fetchKeyRequest,
      { keyId: type },
    );

  if (!fetchKeyResponse.dionysus_content_auth_by_pk) {
    throw new InternalServerErrorException(
      `Content auth key "${type}" is not configured`,
    );
  }

  return fetchKeyResponse.dionysus_content_auth_by_pk.key;
};

/**
 * True when the request carries a valid content auth cookie (issued by
 * VerifyAuthCode). Otherwise false, or 401 unless `silent`.
 */
export const authenticateContentRequest = async (
  graphQLClient: GraphQLClient,
  request: Request,
  silent: boolean = false,
): Promise<boolean> => {
  const token = request.cookies["x-dionysus-content-auth"];

  if (!token) {
    if (!silent) {
      throw new UnauthorizedException();
    }
    return false;
  }

  const signingKey = createSecretKey(
    await getContentAuthKey(graphQLClient, "jwt.key"),
    "utf-8",
  );
  const options: JWTVerifyOptions = {
    algorithms: ["HS256"],
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
};

/**
 * The black curtain: requests without content auth only see assets tagged
 * bcCompliant. Returns `filter` restricted accordingly (or the curtain alone).
 */
export const withContentCurtain = async (
  graphQLClient: GraphQLClient,
  request: Request,
  filter: FilterDefinition | undefined,
  curtain: FilterDefinition = BC_FILTER,
): Promise<FilterDefinition | undefined> => {
  if (await authenticateContentRequest(graphQLClient, request, true)) {
    return filter;
  }
  return filter
    ? { type: FilterType.AND, name: "_", value: [curtain, filter] }
    : curtain;
};

export abstract class BaseAuthenticatedContentController {
  protected readonly graphQLClient: GraphQLClient;

  protected constructor(graphQLClient: GraphQLClient) {
    this.graphQLClient = graphQLClient;
  }

  getAuthenticationKey(type: string): Promise<string> {
    return getContentAuthKey(this.graphQLClient, type);
  }

  authenticateRequest(
    request: Request,
    silent: boolean = false,
  ): Promise<boolean> {
    return authenticateContentRequest(this.graphQLClient, request, silent);
  }

  /** See withContentCurtain. */
  applyCurtain(
    request: Request,
    filter: FilterDefinition | undefined,
  ): Promise<FilterDefinition | undefined> {
    return withContentCurtain(this.graphQLClient, request, filter);
  }
}
