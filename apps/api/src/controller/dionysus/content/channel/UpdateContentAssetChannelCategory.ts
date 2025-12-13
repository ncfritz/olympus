import {
  FullContentAssetChannelCategory,
  UpdateContentAssetChannelCategoryRequest,
  UpdateContentAssetChannelCategoryResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toFullDomainObject } from "../../../../convert/dionysus/content/channel/ContentAssetChannelCategoryConverter";
import { GraphQlFullContentAssetChannelCategory } from "../../../../types/content";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

export type GraphQlUpdateContentAssetChannelResponse = {
  update_dionysus_content_asset_channel_category_by_pk: GraphQlFullContentAssetChannelCategory;
};

@Controller({ version: "1" })
export class UpdateContentAssetChannelCategoryController {
  constructor(protected readonly graphQLClient: GraphQLClient) {}

  @Put("/content/channels/category/:categoryId")
  @ApiOperation({
    summary: "Updates an existing content asset channel category",
    description: "Updates an existing content asset channel category.",
    operationId: "UpdateContentAssetChannelCategory",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: UpdateContentAssetChannelCategoryRequest,
    required: true,
    description: "Input for the CreateBatchJob operation",
  })
  @ApiParam({
    name: "categoryId",
    description: "The ID of the category to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: UpdateContentAssetChannelCategoryResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("categoryId") categoryId: string,
    @Body() request: UpdateContentAssetChannelCategoryRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updateRequest = gql`
      mutation UpdateContentAssetChannelCategory(
        $categoryId: uuid!
        $name: String!
      ) {
        update_dionysus_content_asset_channel_category_by_pk(
          pk_columns: { id: $categoryId }
          _set: { name: $name }
        ) {
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

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateContentAssetChannelResponse>(
        updateRequest,
        {
          categoryId: categoryId,
          name: request.category.name,
        },
      );

    const updatedCategory: FullContentAssetChannelCategory = toFullDomainObject(
      updateResponse.update_dionysus_content_asset_channel_category_by_pk,
    );

    const responseBody: UpdateContentAssetChannelCategoryResponse = {
      category: updatedCategory,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
