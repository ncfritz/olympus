import {
  FullContentAssetChannel,
  FavoriteContentAssetChannelRequest,
  FavoriteContentAssetChannelResponse,
  UpdateContentAssetChannelResponse,
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
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toFullDomainObject } from "../../../../convert/dionysus/content/channel/ContentAssetChannelConverter";
import { GraphQlFullContentAssetChannel } from "../../../../types/content";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

export type GraphQlFavoriteContentAssetChannelResponse = {
  update_dionysus_content_asset_channel_by_pk: GraphQlFullContentAssetChannel;
};

@Controller({ version: "1" })
export class FavoriteContentAssetChannelController {
  constructor(protected readonly graphQLClient: GraphQLClient) {}

  @Put("/content/channel/:channelId/favorite")
  @ApiOperation({
    summary: "Updates an existing content asset channel",
    description: "Updates an existing content asset channel.",
    operationId: "FavoriteContentAssetChannel",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: FavoriteContentAssetChannelRequest,
    required: true,
    description: "Input for the CreateBatchJob operation",
  })
  @ApiParam({
    name: "channelId",
    description: "The ID of the channel to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: FavoriteContentAssetChannelResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("channelId") channelId: string,
    @Body() request: FavoriteContentAssetChannelRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updateRequest = gql`
      mutation UpdateContentAssetChannel(
        $channelId: uuid!
        $favorite: Boolean!
      ) {
        update_dionysus_content_asset_channel_by_pk(
          pk_columns: { id: $channelId }
          _set: { favorite: $favorite }
        ) {
          ttl
          name
          lastUpdatedTime
          lastFetchedTime
          jitter
          id
          filterInput
          favorite
          encodedFilter
          description
          createdTime
          category {
            createdTime
            id
            lastUpdatedTime
            name
            channels_aggregate {
              aggregate {
                count
              }
            }
          }
          bcCompliant
          assetCount
          assetCache {
            assetId
            width
            height
            createdTime
          }
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlFavoriteContentAssetChannelResponse>(
        updateRequest,
        {
          channelId: channelId,
          favorite: request.favorite,
        },
      );

    const updatedCategory: FullContentAssetChannel = toFullDomainObject(
      updateResponse.update_dionysus_content_asset_channel_by_pk,
    );

    const responseBody: UpdateContentAssetChannelResponse = {
      channel: updatedCategory,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
