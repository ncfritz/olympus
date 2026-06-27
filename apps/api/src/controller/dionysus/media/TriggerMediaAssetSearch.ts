import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  FilterDefinition,
  FilterType,
  MediaAssetSearchConfiguration,
  MediaAssetSearchConfigurationStatus,
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
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toDecoratedDomainObject } from "../../../convert/dionysus/media/MediaAssetSearchConfigurationConverter";
import { BASE_DECORATED_SEARCH_CONFIGURATION } from "../../../query/dionysus/media/searchConfigutation";
import { GraphQlDecoratedMediaAssetSearchConfiguration } from "../../../types/dionysus/media/searchConfiguration";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { buildFilterExpression } from "../../../utils/filterUtil";
import { logger } from "../../../utils/logger";
import { BaseMediaAssetSearchConfigurationController } from "./BaseMediaAssetSearchConfigurationController";

type GraphQlUpdateMediaAssetSearchConfigurationResponse = {
  update_dionysus_media_asset_search_configuration_by_pk: GraphQlDecoratedMediaAssetSearchConfiguration;
};
type GraphQlUpdateChildMediaAssetSearchConfigurationsResponse = {
  update_dionysus_media_asset_search_configuration: {
    affected_rows: number;
  };
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
    @Res()
    response: Response,
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
          ${BASE_DECORATED_SEARCH_CONFIGURATION}
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

    const updatedSearchConfiguration = toDecoratedDomainObject(
      updateResponse.update_dionysus_media_asset_search_configuration_by_pk,
    );

    if (
      mediaType === MediaAssetSearchType.TV_SERIES ||
      mediaType === MediaAssetSearchType.TV_SEASON
    ) {
      await this.updateChildSearchConfigurations(fetchedSearchConfiguration);
    }

    const msg: any = {
      mediaId: updatedSearchConfiguration.mediaId,
      propagateImmediately: true,
      initiatingAsset: {
        assetType: mediaType,
        mediaId: mediaId,
      },
    };

    if (updatedSearchConfiguration.type === MediaAssetSearchType.TV_SEASON) {
      msg.initiatingAsset = {
        assetType: mediaType,
        mediaId: mediaId,
        seriesId: updatedSearchConfiguration.seriesId,
        seasonNumber: updatedSearchConfiguration.seasonNumber,
      };
    } else if (
      updatedSearchConfiguration.type === MediaAssetSearchType.TV_EPISODE
    ) {
      msg.initiatingAsset = {
        assetType: mediaType,
        mediaId: mediaId,
        seriesId: updatedSearchConfiguration.seriesId,
        seasonNumber: updatedSearchConfiguration.seasonNumber,
        episodeNumber: updatedSearchConfiguration.episodeNumber,
      };
    }

    await this.amqpConnection.publish(
      "search.execution.trigger",
      `jobType.${updatedSearchConfiguration.type}`,
      msg,
      {
        persistent: true,
        headers: {
          "x-delay": 0,
        },
      },
    );

    const responseBody: SingleMediaAssetSearchConfigurationResponse = {
      searchConfiguration: updatedSearchConfiguration,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }

  private async updateChildSearchConfigurations(
    searchConfiguration: MediaAssetSearchConfiguration,
  ) {
    const filters: FilterDefinition[] = [];
    let updateFilter: FilterDefinition | undefined = undefined;

    if (searchConfiguration.type === MediaAssetSearchType.TV_SERIES) {
      filters.push({
        type: FilterType.EQUALS,
        name: "seriesId",
        value: searchConfiguration.mediaId,
      });
    }

    if (searchConfiguration.type === MediaAssetSearchType.TV_SEASON) {
      filters.push({
        type: FilterType.EQUALS,
        name: "seriesId",
        value: searchConfiguration.seriesId!,
      });
      filters.push({
        type: FilterType.EQUALS,
        name: "seasonNumber",
        value: searchConfiguration.seasonNumber!,
      });
    }

    if (filters.length > 0) {
      updateFilter = {
        type: FilterType.AND,
        name: "_",
        value: filters,
      };
    }

    const updateChildrenRequest = gql`
      mutation UpdateChildSearchConfigurations(
        $status: String!
      ) {
        update_dionysus_media_asset_search_configuration(
          ${buildFilterExpression(updateFilter)} 
          _set: { status: $status }
        ) {
          affected_rows
        }
      }
    `;

    const updateChildrenResponse =
      await this.graphQLClient.request<GraphQlUpdateChildMediaAssetSearchConfigurationsResponse>(
        updateChildrenRequest,
        { status: MediaAssetSearchConfigurationStatus.UPDATING },
      );

    logger.info(
      `Updated ${updateChildrenResponse.update_dionysus_media_asset_search_configuration.affected_rows} child search configurations`,
    );
  }
}
