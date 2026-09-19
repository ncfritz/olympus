import {
  ContentAssetTag,
  ListAvailableContentAssetTagsResponse,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/ContentAssetTagConverter";
import { GraphQlContentAssetTag } from "../../types/content";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQListContentAssetTagsResponse = {
  dionysus_content_tags: GraphQlContentAssetTag[];
};

@Controller({ version: "1" })
export class ListAvailableContentAssetTagsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/content/assetTags")
  @ApiOperation({
    summary: "Lists the available content asset tags",
    description:
      "Lists the available content asset tags.  This API accepts an optional content asset ID," +
      "tag type, and name. ",
    operationId: "ListAvailableContentAssetTags",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "assetId",
    description: "The ID of the content asset to the tags for",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "type",
    description: "Filter available tags by the type",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "name",
    description: "Filter based on the name.  This is a wildcard match",
    type: String,
    required: false,
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: ListAvailableContentAssetTagsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("assetId") assetId: string | undefined,
    @Query("type") type: string | undefined,
    @Query("name") name: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const queryPlaceholders = [];
    const queryFilters = [];
    const queryVariables: Record<string, string> = {};

    if (assetId) {
      queryPlaceholders.push("$contentId: uuid!");
      queryVariables.contentId = assetId;
      queryFilters.push(
        "_not: { tagged_content: { content_id: { _eq: $contentId } } }",
      );
    }

    if (type) {
      queryPlaceholders.push("$type: String");
      queryVariables.type = type;
      queryFilters.push("type: { _eq: $type }");
    }

    if (name) {
      queryPlaceholders.push("$name: String");
      queryVariables.name = `%${name}%`;
      queryFilters.push("name: { _ilike: $name }");
    }

    const placeholders =
      queryPlaceholders.length > 0 ? `(${queryPlaceholders.join("\n")})` : "";
    let whereClause = "";

    if (queryFilters.length > 0) {
      whereClause =
        queryFilters.length > 1
          ? `(where: { _and: {${queryFilters.join("\n")}}})`
          : `(where: {${queryFilters[0]}})`;
    }

    const queryRequest = gql`
      query ListContentAssetTags${placeholders} {
        dionysus_content_tags${whereClause} {
          type
          name
          content_tag_id
          createdTime
        }
      }
    `;

    const queryResponse = await this.graphQLClient.request<
      GraphQListContentAssetTagsResponse,
      Record<string, string>
    >(queryRequest, queryVariables);

    const tags: ContentAssetTag[] = [];

    queryResponse.dionysus_content_tags.forEach((responseTag) => {
      tags.push(toDomainObject(responseTag));
    });

    const responseBody: ListAvailableContentAssetTagsResponse = {
      tags: tags,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
