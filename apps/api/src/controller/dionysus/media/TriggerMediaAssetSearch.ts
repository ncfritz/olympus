import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  MediaAssetSearchType,
  SingleMediaAssetSearchConfigurationResponse,
} from "@ncfritz/olympus-model";
import {
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Param,
  Put,
  Res,
  UseInterceptors,
} from "@nestjs/common";
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
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetSearchConfigurationConverter";
import { BASE_SEARCH_CONFIGURATION } from "../../../query/dionysus/media/searchConfigutation";
import { GraphQlMediaAssetSearchConfiguration } from "../../../types/dionysus/media/searchConfiguration";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { BaseMediaAssetSearchConfigurationController } from "./BaseMediaAssetSearchConfigurationController";

type GraphQlUpdateMediaAssetSearchConfigurationResponse = {
  update_dionysus_media_asset_search_configuration_by_pk: GraphQlMediaAssetSearchConfiguration;
};

@Controller({ version: "1" })
export class TriggerMediaAssetSearchController extends BaseMediaAssetSearchConfigurationController {
  constructor(
    protected readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {
    super(graphQLClient);
  }

  @Put("/media/searchConfiguration/:mediaType/:mediaId/trigger")
  @ApiOperation({
    summary: "Triggers an existing media search configuration",
    description:
      "Triggers an existing media search configuration.  The search will be enqueued immediately for execution, " +
      "ignoring any existing `nextExecutionTime` stamped on the search configuration",
    operationId: "TriggerMediaAssetSearch",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type media asset the search configuration is for",
    enum: MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
  })
  @ApiParam({
    name: "mediaId",
    description:
      "The ID of the media that the search configuration is targeting.",
    type: Number,
  })
  @ApiOkResponse({
    description: "The search has been successfully triggered.",
    type: SingleMediaAssetSearchConfigurationResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchedSearchConfiguration =
      await this.fetchMediaAssetSearchConfiguration(mediaType, mediaId);

    const updateRequest = gql`
      mutation UpdateMediaAssetSearchConfiguration(
        $mediaType: String!
        $mediaId: numeric!
        $changes: dionysus_media_asset_search_configuration_set_input = {}
      ) {
        update_dionysus_media_asset_search_configuration_by_pk(
          pk_columns: { assetType: $mediaType, mediaId: $mediaId }
          _set: $changes
        ) {
          ${BASE_SEARCH_CONFIGURATION}
        }
      }
    `;

    const nextExecutionTime = moment
      .utc()
      .add(
        Math.floor(Math.random() * (fetchedSearchConfiguration.jitter || 300)),
        "minutes",
      );

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMediaAssetSearchConfigurationResponse>(
        updateRequest,
        {
          mediaType: mediaType,
          mediaId: mediaId,
          changes: {
            nextExecutionTime: nextExecutionTime.toISOString(),
          },
        },
      );

    const updatedSearchConfiguration = toDomainObject(
      updateResponse.update_dionysus_media_asset_search_configuration_by_pk,
    );

    await this.amqpConnection.publish(
      "search.execution.trigger",
      `jobType.${updatedSearchConfiguration.type}`,
      {
        mediaId: updatedSearchConfiguration.mediaId,
        propagateImmediately: true,
      },
      {
        persistent: true,
      },
    );

    const responseBody: SingleMediaAssetSearchConfigurationResponse = {
      searchConfiguration: updatedSearchConfiguration,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
