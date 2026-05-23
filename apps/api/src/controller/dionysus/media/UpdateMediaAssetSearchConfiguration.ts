import {
  FilterDefinition,
  FilterType,
  MediaAssetSearchConfiguration,
  MediaAssetSearchType,
  SingleMediaAssetSearchConfigurationResponse,
  UpdateMediaAssetSearchConfigurationRequest,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Param,
  Put,
  Query,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetSearchConfigurationConverter";
import { BASE_SEARCH_CONFIGURATION } from "../../../query/dionysus/media/searchConfigutation";
import { GraphQlMediaAssetSearchConfiguration } from "../../../types/dionysus/media/searchConfiguration";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { buildFilterExpression } from "../../../utils/filterUtil";
import { logger } from "../../../utils/logger";

type GraphQlUpdateMediaAssetSearchConfigurationResponse = {
  update_dionysus_media_asset_search_configuration_by_pk: GraphQlMediaAssetSearchConfiguration;
};
type GraphQlUpdateChildMediaAssetSearchConfigurationsResponse = {
  update_dionysus_media_asset_search_configuration: {
    affected_rows: number;
  };
};

@Controller({ version: "1" })
export class UpdateMediaAssetSearchConfigurationController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/media/searchConfiguration/:mediaType/:mediaId")
  @ApiOperation({
    summary: "Updates an existing media search configuration",
    description:
      "Updates an existing media search configuration.  When setting the `enabled` status of a search configuration, " +
      "the status will be propagated to any child configurations if the `recursive` parameter is set to `true` - " +
      "i.e. disabling a search configuration for a TV season will disable any search configurations for episodes of " +
      "that season.  If the `recursive` parameter is set to `false` or not specified, only the directly identified" +
      "search configuration will be updated",
    operationId: "UpdateMediaAssetSearchConfiguration",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMediaAssetSearchConfigurationRequest,
    description: "Input for the UpdateMediaAssetSearchConfiguration operation",
  })
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
  @ApiQuery({
    name: "recursive",
    description:
      "When set to `true` any child entities - seasons/episodes - will be updated with the specified `enabled` status.",
    type: "boolean",
    required: false,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: SingleMediaAssetSearchConfigurationResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
    @Query("recursive") recursive: boolean = false,
    @Body() request: UpdateMediaAssetSearchConfigurationRequest,
    @Res() response: Response,
  ): Promise<void> {
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

    const changes = { ...request.searchConfiguration };

    if (!request.searchConfiguration.nextExecutionTime) {
      changes.nextExecutionTime = moment
        .utc()
        .add(
          Math.floor(
            Math.random() * (request.searchConfiguration.jitter || 300),
          ),
          "minutes",
        );
    }

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMediaAssetSearchConfigurationResponse>(
        updateRequest,
        {
          mediaType: mediaType,
          mediaId: mediaId,
          changes: changes,
        },
      );

    const updatedSearchConfiguration = toDomainObject(
      updateResponse.update_dionysus_media_asset_search_configuration_by_pk,
    );

    // If the update property set contains the "enabled" property and the media type is a TV season or TV series
    // cascade the enabled status to all child configurations
    if (
      Object.keys(request.searchConfiguration).includes("enabled") &&
      (updatedSearchConfiguration.type === MediaAssetSearchType.TV_SERIES ||
        updatedSearchConfiguration.type === MediaAssetSearchType.TV_SEASON) &&
      recursive
    ) {
      await this.updateChildSearchConfigurations(updatedSearchConfiguration);
    }

    const responseBody: SingleMediaAssetSearchConfigurationResponse = {
      searchConfiguration: updatedSearchConfiguration,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }

  private async updateChildSearchConfigurations(
    configuration: MediaAssetSearchConfiguration,
  ) {
    logger.debug(
      `Updating child search configuration statuses to ${configuration.enabled}`,
    );

    let filter: FilterDefinition = {
      type: FilterType.EQUALS,
      name: "seriesId",
      value:
        configuration.type === MediaAssetSearchType.TV_SEASON
          ? configuration.seriesId!
          : configuration.mediaId,
    };

    if (configuration.type === MediaAssetSearchType.TV_SEASON) {
      filter = {
        type: FilterType.AND,
        name: "_",
        value: [
          filter,
          {
            type: FilterType.EQUALS,
            name: "seasonNumber",
            value: configuration.seasonNumber!,
          },
        ],
      };
    }

    const updateChildrenRequest = gql`
      mutation UpdateChildSearchConfigurations(
        $enabled: Boolean
      ) {
        update_dionysus_media_asset_search_configuration(
          ${buildFilterExpression(filter)} 
          _set: { enabled: $enabled }
        ) {
          affected_rows
        }
      }
    `;

    const updateChildrenResponse =
      await this.graphQLClient.request<GraphQlUpdateChildMediaAssetSearchConfigurationsResponse>(
        updateChildrenRequest,
        { enabled: configuration.enabled },
      );

    logger.info(
      `Updated ${updateChildrenResponse.update_dionysus_media_asset_search_configuration.affected_rows} child search configurations`,
    );
  }
}
