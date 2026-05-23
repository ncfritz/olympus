import {
  FullContentAssetChannel,
  UpdateContentAssetChannelRequest,
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
import moment from "moment";
import { toFullDomainObject } from "../../../../convert/dionysus/content/channel/ContentAssetChannelConverter";
import { GraphQlFullContentAssetChannel } from "../../../../types/content";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseContentAssetChannelController } from "./BaseContentAssetChannelController";

export type GraphQlUpdateContentAssetChannelResponse = {
  insert_dionysus_content_asset_channel_cache: {
    affected_rows: number;
  };
  update_dionysus_content_asset_channel_by_pk: GraphQlFullContentAssetChannel;
};

@Controller({ version: "1" })
export class UpdateContentAssetChannelController extends BaseContentAssetChannelController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Put("/content/channel/:channelId")
  @ApiOperation({
    summary: "Updates an existing content asset channel",
    description: "Updates an existing content asset channel.",
    operationId: "UpdateContentAssetChannel",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: UpdateContentAssetChannelRequest,
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
    type: UpdateContentAssetChannelResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("channelId") channelId: string,
    @Body() request: UpdateContentAssetChannelRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.clearContentAssetChannelCache(channelId);
    const assetCache = await this.buildAssetCacheEntries(
      request.channel.filterDefinition,
      channelId,
    );

    const updateRequest = gql`
      mutation UpdateContentAssetChannel(
        $channelId: uuid!
        $name: String!
        $description: String!
        $bcCompliant: Boolean!
        $filterInput: String!
        $encodedFilter: String!
        $lastFetchedTime: timestamptz!
        $assetCount: numeric
        $assetCache: [dionysus_content_asset_channel_cache_insert_input!]!
      ) {
        insert_dionysus_content_asset_channel_cache(objects: $assetCache) {
          affected_rows
        }
        update_dionysus_content_asset_channel_by_pk(
          pk_columns: { id: $channelId }
          _set: {
            lastFetchedTime: $lastFetchedTime
            name: $name
            description: $description
            bcCompliant: $bcCompliant
            filterInput: $filterInput
            encodedFilter: $encodedFilter
            assetCount: $assetCount
          }
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
      await this.graphQLClient.request<GraphQlUpdateContentAssetChannelResponse>(
        updateRequest,
        {
          channelId: channelId,
          name: request.channel.name,
          description: request.channel.description,
          bcCompliant: request.channel.bcCompliant,
          filterInput: request.channel.filterInput,
          encodedFilter: Buffer.from(
            JSON.stringify(request.channel.filterDefinition),
          ).toString("base64"),
          lastFetchedTime: moment.utc().toISOString(),
          assetCount: assetCache.assetCount,
          assetCache: assetCache.entries,
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
