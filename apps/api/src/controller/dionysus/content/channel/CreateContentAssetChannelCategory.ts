import {
  CreateContentAssetChannelCategoryRequest,
  CreateContentAssetChannelCategoryResponse,
  FullContentAssetChannelCategory,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toFullDomainObject } from "../../../../convert/dionysus/content/channel/ContentAssetChannelCategoryConverter";
import { GraphQlFullContentAssetChannelCategory } from "../../../../types/content";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlCreateContentAssetChannelCategoryResponse = {
  insert_dionysus_content_asset_channel_category_one: GraphQlFullContentAssetChannelCategory;
};

@Controller({ version: "1" })
export class CreatContentAssetChannelCategoryController {
  constructor(protected readonly graphQLClient: GraphQLClient) {}

  @Post("/content/channels/categories")
  @ApiOperation({
    summary: "Creates a new content asset channel category",
    description: "Creates a new content asset channel category.",
    operationId: "CreateContentAssetChannelCategory",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateContentAssetChannelCategoryRequest,
    required: true,
    description: "Input for the CreateBatchJob operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateContentAssetChannelCategoryResponse,
    headers: {
      Location: {
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateContentAssetChannelCategoryRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateContentAssetChannelCategory($name: String!) {
        insert_dionysus_content_asset_channel_category_one(
          object: { name: $name }
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

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateContentAssetChannelCategoryResponse>(
        insertRequest,
        {
          name: request.category.name,
        },
      );

    const createdCategory: FullContentAssetChannelCategory = toFullDomainObject(
      insertResponse.insert_dionysus_content_asset_channel_category_one,
    );

    const responseBody: CreateContentAssetChannelCategoryResponse = {
      category: createdCategory,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/content/channels/categories/${createdCategory.id}`,
      )
      .send(responseBody);
  }
}
