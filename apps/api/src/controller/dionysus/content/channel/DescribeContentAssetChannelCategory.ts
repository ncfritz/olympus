import {
  DescribeContentAssetChannelCategoryResponse,
  FullContentAssetChannelCategory,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toFullDomainObject } from "../../../../convert/dionysus/content/channel/ContentAssetChannelCategoryConverter";
import { GraphQlFullContentAssetChannelCategory } from "../../../../types/content";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

export type GraphQlDescribeContentAssetChannelResponse = {
  dionysus_content_asset_channel_category_by_pk: GraphQlFullContentAssetChannelCategory | null;
};

@Controller({ version: "1" })
export class DescribeContentAssetChannelCategoryController {
  constructor(protected readonly graphQLClient: GraphQLClient) {}

  @Get("/content/channel/category/:categoryId")
  @ApiOperation({
    summary: "Describes an existing content asset channel category",
    description: "Describes an existing content asset channel category.",
    operationId: "DescribeContentAssetChannelCategory",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "categoryId",
    description: "The ID of the channel category to describe",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeContentAssetChannelCategoryResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("categoryId") categoryId: string,
    @Res() response: Response,
  ): Promise<void> {
    const queryRequest = gql`
      query DescribeContentAssetChannelCategory($categoryId: uuid!) {
        dionysus_content_asset_channel_category_by_pk(id: $categoryId) {
          createdTime
          id
          lastUpdatedTime
          name
          channels(limit: 10) {
            bcCompliant
            categoryId
            createdTime
            description
            encodedFilter
            favorite
            filterInput
            id
            jitter
            lastFetchedTime
            lastUpdatedTime
            name
            ttl
            assetCache {
              assetId
              createdTime
            }
          }
          channels_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeContentAssetChannelResponse>(
        queryRequest,
        {
          categoryId: categoryId,
        },
      );

    if (!queryResponse.dionysus_content_asset_channel_category_by_pk) {
      throw new NotFoundException();
    }

    const category: FullContentAssetChannelCategory = toFullDomainObject(
      queryResponse.dionysus_content_asset_channel_category_by_pk,
    );

    const responseBody: DescribeContentAssetChannelCategoryResponse = {
      category: category,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
