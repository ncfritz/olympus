import {
  FullContentAssetChannel,
  RefreshContentAssetChannelResponse,
} from "@ncfritz/olympus-model";
import { Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toFullDomainObject } from "../../../../convert/dionysus/content/channel/ContentAssetChannelConverter";
import { GraphQlFullContentAssetChannel } from "../../../../types/content";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseContentAssetChannelController } from "./BaseContentAssetChannelController";

type GraphQlChannelFilterResponse = {
  dionysus_content_asset_channel_by_pk: {
    encodedFilter: string;
  };
};

export type GraphQlRefreshContentAssetChannelResponse = {
  insert_dionysus_content_asset_channel_cache: {
    affected_rows: number;
  };
  update_dionysus_content_asset_channel_by_pk: GraphQlFullContentAssetChannel;
};

@Controller({ version: "1" })
export class RefreshContentAssetChannelController extends BaseContentAssetChannelController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Post("/content/channel/:channelId/refresh")
  @ApiOperation({
    summary: "Refreshes an existing content asset channel",
    description: "Refreshes an existing content asset channel.",
    operationId: "RefreshContentAssetChannel",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "channelId",
    description: "The ID of the channel to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: RefreshContentAssetChannelResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("channelId") channelId: string,
    @Res() response: Response,
  ): Promise<void> {
    const getFilterRequest = gql`
      query GetContentAssetChannelFilter($id: uuid!) {
        dionysus_content_asset_channel_by_pk(id: $id) {
          encodedFilter
        }
      }
    `;

    const getChannelFilterResponse =
      await this.graphQLClient.request<GraphQlChannelFilterResponse>(
        getFilterRequest,
        { id: channelId },
      );

    const assetCache = await this.buildAssetCacheEntries(
      getChannelFilterResponse.dionysus_content_asset_channel_by_pk
        .encodedFilter,
      channelId,
    );
    await this.clearContentAssetChannelCache(channelId);

    const updateRequest = gql`
      mutation UpdateContentAssetChannelCache(
        $channelId: uuid!
        $lastFetchedTime: timestamptz!
        $assetCount: numeric
        $assetCache: [dionysus_content_asset_channel_cache_insert_input!]!
      ) {
        insert_dionysus_content_asset_channel_cache(objects: $assetCache) {
          affected_rows
        }
        update_dionysus_content_asset_channel_by_pk(
          pk_columns: { id: $channelId }
          _set: { lastFetchedTime: $lastFetchedTime, assetCount: $assetCount }
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
      await this.graphQLClient.request<GraphQlRefreshContentAssetChannelResponse>(
        updateRequest,
        {
          channelId: channelId,
          lastFetchedTime: moment.utc().toISOString(),
          assetCount: assetCache.assetCount,
          assetCache: assetCache.entries,
        },
      );

    const updatedCategory: FullContentAssetChannel = toFullDomainObject(
      updateResponse.update_dionysus_content_asset_channel_by_pk,
    );

    const responseBody: RefreshContentAssetChannelResponse = {
      channel: updatedCategory,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
