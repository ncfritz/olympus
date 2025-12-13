import { EmptyResponse } from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiGoneResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { GraphQlContentAssetChannel } from "../../../../types/content";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

export type GraphQlDeleteContentAssetChannelResponse = {
  insert_dionysus_content_asset_channel_cache: {
    affected_rows: number;
  };
  delete_dionysus_content_asset_channel_by_pk: GraphQlContentAssetChannel;
};

@Controller({ version: "1" })
export class DeleteContentAssetChannelController {
  constructor(protected readonly graphQLClient: GraphQLClient) {}

  @Delete("/content/channel/:channelId")
  @ApiOperation({
    summary: "Deletes an existing content asset channel",
    description: "Deletes an existing content asset channel.",
    operationId: "DeleteContentAssetChannel",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "channelId",
    description: "The ID of the channel to delete",
    type: String,
  })
  @ApiGoneResponse({
    description: "The content asset channel was successfully removed.",
    type: EmptyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("channelId") channelId: string,
    @Res() response: Response,
  ): Promise<void> {
    const deleteRequest = gql`
      mutation DeleteContentChannel($channelId: uuid!) {
        delete_dionysus_content_asset_channel_by_pk(id: $channelId) {
          id
        }
        delete_dionysus_content_asset_channel_cache(
          where: { channel_id: { _eq: $channelId } }
        ) {
          affected_rows
        }
      }
    `;

    await this.graphQLClient.request<GraphQlDeleteContentAssetChannelResponse>(
      deleteRequest,
      {
        channelId: channelId,
      },
    );

    response.status(HttpStatus.GONE).send({});
  }
}
