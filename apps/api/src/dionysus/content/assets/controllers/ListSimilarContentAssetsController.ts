import {
  ContentAsset,
  ListSimilarContentAssetsResponse,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Req,
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
import { type Request, type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/ContentAssetConverter";
import { GraphQLContentAsset } from "../../types/content";
import { authenticateContentRequest } from "../../auth/controllers/BaseAuthenticatedContentController";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlListSimilarContentAssetsInput = {
  content_id: string;
};

type GraphQlListSimilarContentAssetsResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
};

@Controller({ version: "1" })
export class ListSimilarContentAssetsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/content/asset/:assetId/similar")
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
    required: true,
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
    description:
      "Ignored; kept for SDK compatibility. The black curtain applies to every request without a valid content auth cookie.",
    required: false,
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
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (!tagNames || !tagTypes) {
      throw new BadRequestException("tagType and tagName are required");
    }

    const splitTagNames = tagNames.split(",");
    const splitTagTypes = tagTypes.split(",");

    if (splitTagNames.length <= 0 || splitTagTypes.length <= 0) {
      throw new BadRequestException("Invalid tag specification");
    }

    if (splitTagNames.length !== splitTagTypes.length) {
      throw new BadRequestException("Invalid tag specification");
    }

    const tagFilters: string[] = [];
    const aggregateTagFilters: string[] = [];
    let blackCurtainClause = "";
    let blackCurtainAggregateClause = "";

    for (let i = 0; i < splitTagTypes.length; i++) {
      tagFilters.push(
        `{ asset_tags: {tag: {_and: { name: { _ilike: ${JSON.stringify(splitTagNames[i])} }, type: { _eq: ${JSON.stringify(splitTagTypes[i])} } } } } }`,
      );
      aggregateTagFilters.push(
        `{ tag: {_and: { name: { _ilike: ${JSON.stringify(splitTagNames[i])} }, type: { _eq: ${JSON.stringify(splitTagTypes[i])} } } } }`,
      );
    }

    if (
      !(await authenticateContentRequest(this.graphQLClient, request, true))
    ) {
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
