import {
  ContentAsset,
  ListSimilarContentAssetsResponse,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/content/ContentAssetConverter";
import { GraphQLContentAsset } from "../../types/content";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlListSimilarContentAssetsInput = {
  content_id: string;
};

type GraphQlListSimilarContentAssetsResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
};

@Controller()
export class ListSimilarContentAssetsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/content/asset/:assetId/similar")
  @ApiOperation({
    summary: "Lists similar content assets",
    description:
      "Lists content assets that are similar to this one based on the supplied set of tags.",
    operationId: "ListSimilarContentAssets",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "assetId",
    description: "The ID of the content asset to find similar assets for",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "tagType",
    explode: false,
    type: String,
    isArray: true,
  })
  @ApiQuery({
    name: "tagName",
    explode: false,
    type: String,
    isArray: true,
  })
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description: "Header indicating black curtain status",
  })
  @ApiOkResponse({
    description: "The list of similar assets capped at 25 items",
    type: () => ListSimilarContentAssetsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("assetId") assetId: string,
    @Query("tagType") tagTypes: string,
    @Query("tagName") tagNames: string,
    @Headers("x-dionysus-content-bc") blackCurtain: string,
    @Res() response: Response,
  ): Promise<void> {
    const splitTagNames = tagNames.split(",");
    const splitTagTypes = tagTypes.split(",");

    if (splitTagNames.length <= 0 || splitTagTypes.length <= 0) {
      response.status(HttpStatus.BAD_REQUEST).end();
      return;
    }

    if (splitTagNames.length !== splitTagTypes.length) {
      response.status(HttpStatus.BAD_REQUEST).end();
      return;
    }

    const tagFilters: string[] = [];
    const aggregateTagFilters: string[] = [];
    let blackCurtainClause = "";
    let blackCurtainAggregateClause = "";

    for (let i = 0; i < splitTagTypes.length; i++) {
      tagFilters.push(
        `{ asset_tags: {tag: {_and: { name: { _ilike: "${splitTagNames[i]}" }, type: { _eq: "${splitTagTypes[i]}" } } } } }`,
      );
      aggregateTagFilters.push(
        `{ tag: {_and: { name: { _ilike: "${splitTagNames[i]}" }, type: { _eq: "${splitTagTypes[i]}" } } } }`,
      );
    }

    if (blackCurtain === "true") {
      blackCurtainClause =
        '{ asset_tags: {tag: {_and: {type: {_eq: "system"}, name: {_ilike: "bcCompliant"}}}}}';
      blackCurtainAggregateClause =
        '{ tag: {_and: {type: {_eq: "system"}, name: {_ilike: "bcCompliant"}}}}';
    }

    const fetchRequest = gql`
      query ListSimilarContentAssets($content_id: uuid) {
        dionysus_content_assets(
          where: {
            _and: [
              { _not: { content_id: { _eq: $content_id } } }
              ${blackCurtainClause}
            ]
            _or: [
              ${tagFilters.join("\n")}
            ]
          }
          order_by: [{ asset_tags_aggregate: { count: desc } }]
          limit: 25
        ) {
          name
          rating
          original_name
          asset_tags_aggregate(
            where: {
              _and: [
                { _not: { content_id: { _eq: $content_id } } }
                ${blackCurtainAggregateClause}
              ]
              _or: [
                ${aggregateTagFilters.join("\n")}
              ]
            }
          ) {
            aggregate {
              count
            }
          }
          width
          original_size
          original_sha
          height
          duration
          createdTime
          content_id
          asset_tags {
            tag {
              content_tag_id
              createdTime
              name
              type
            }
          }
        }
      }
    `;

    const fetchResponse = await this.graphQLClient.request<
      GraphQlListSimilarContentAssetsResponse,
      GraphQlListSimilarContentAssetsInput
    >(fetchRequest, {
      content_id: assetId,
    });
    const fetchedAssets: ContentAsset[] = [];

    fetchResponse.dionysus_content_assets.forEach((result) => {
      fetchedAssets.push(toDomainObject(result));
    });

    const responseBody: ListSimilarContentAssetsResponse = {
      assets: fetchedAssets,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
