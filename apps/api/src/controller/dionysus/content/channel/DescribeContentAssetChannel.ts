import {
  DescribeContentAssetChannelResponse,
  FullContentAssetChannel,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toFullDomainObject } from "../../../../convert/dionysus/content/channel/ContentAssetChannelConverter";
import { GraphQlFullContentAssetChannel } from "../../../../types/content";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { authenticateContentRequest } from "../auth/BaseAuthenticatedContentController";

export type GraphQlDescribeContentAssetChannelResponse = {
  dionysus_content_asset_channel_by_pk: GraphQlFullContentAssetChannel | null;
};

@Controller({ version: "1" })
export class DescribeContentAssetChannelController {
  constructor(protected readonly graphQLClient: GraphQLClient) {}

  @Get("/content/channel/:channelId")
  @ApiOperation({
    summary: "Describes a content asset channel",
    description: "Retrieves the details of a content asset channel.",
    operationId: "DescribeContentAssetChannel",
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
    type: DescribeContentAssetChannelResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("channelId") channelId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const queryRequest = gql`
      query DescribeContentAssetChannel($channelId: uuid!) {
        dionysus_content_asset_channel_by_pk(id: $channelId) {
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

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeContentAssetChannelResponse>(
        queryRequest,
        {
          channelId: channelId,
        },
      );

    if (!queryResponse.dionysus_content_asset_channel_by_pk) {
      throw new NotFoundException();
    }

    if (
      !queryResponse.dionysus_content_asset_channel_by_pk.bcCompliant &&
      !(await authenticateContentRequest(this.graphQLClient, request, true))
    ) {
      throw new NotFoundException();
    }

    const channel: FullContentAssetChannel = toFullDomainObject(
      queryResponse.dionysus_content_asset_channel_by_pk,
    );

    const responseBody: DescribeContentAssetChannelResponse = {
      channel: channel,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
