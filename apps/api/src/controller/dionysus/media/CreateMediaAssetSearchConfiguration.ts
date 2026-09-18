import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  CreateMediaAssetSearchConfigurationRequest,
  DecoratedMediaAssetSearchConfiguration,
  MediaAssetSearchType,
  SingleMediaAssetSearchConfigurationResponse,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toDecoratedDomainObject } from "../../../convert/dionysus/media/MediaAssetSearchConfigurationConverter";
import { BASE_MEDIA_ASSET } from "../../../query/dionysus/media/mediaAsset";
import { BASE_DECORATED_SEARCH_CONFIGURATION } from "../../../query/dionysus/media/searchConfigutation";
import { GraphQlMediaAsset } from "../../../types/dionysus/media/mediaAsset";
import { type GraphQlDecoratedMediaAssetSearchConfiguration } from "../../../types/dionysus/media/searchConfiguration";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type QueryRoot =
  | "dionysus_movies_by_pk"
  | "dionysus_tv_series_by_pk"
  | "dionysus_tv_seasons_by_pk"
  | "dionysus_tv_episodes_by_pk";
type GraphQlVerifyMediaResponse = {
  dionysus_movies_by_pk?: {
    id: string;
    asset?: GraphQlMediaAsset;
  };
  dionysus_tv_series_by_pk?: {
    id: string;
    asset?: GraphQlMediaAsset;
  };
  dionysus_tv_seasons_by_pk?: {
    id: string;
    asset?: GraphQlMediaAsset;
  };
  dionysus_tv_episodes_by_pk?: {
    id: string;
    asset: GraphQlMediaAsset;
  };
};

type GraphQlCreateMediaAssetSearchConfigurationResponse = {
  insert_dionysus_media_asset_search_configuration_one: GraphQlDecoratedMediaAssetSearchConfiguration;
};

@Controller({ version: "1" })
export class CreateMediaAssetSearchConfigurationController {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @Post("/media/searchConfigurations")
  @ApiOperation({
    summary: "Creates a new media asset search configuration",
    description:
      "Creates a new media asset search configuration.  The search will not be immediately executed, however the " +
      "`nextExecutionTime` will be calculated based on the current time and the jitter value provided.  If the " +
      "media the search configuration is being created for has an existing asset associated with it, the search " +
      "configuration will be disabled by default.  If no asset exists for the media, the configuration will be " +
      "enabled.",
    operationId: "CreateMediaAssetSearchConfiguration",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMediaAssetSearchConfigurationRequest,
    required: true,
    description: "Input for the CreateMediaAssetSearchConfiguration operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaAssetSearchConfigurationResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created search configuration",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateMediaAssetSearchConfigurationRequest,
    @Res() response: Response,
  ): Promise<void> {
    let graphQLQueryRoot: QueryRoot = "dionysus_movies_by_pk";

    if (request.searchConfiguration.type === MediaAssetSearchType.TV_SERIES) {
      graphQLQueryRoot = "dionysus_tv_series_by_pk";
    } else if (
      request.searchConfiguration.type === MediaAssetSearchType.TV_SEASON
    ) {
      graphQLQueryRoot = "dionysus_tv_seasons_by_pk";
    } else if (
      request.searchConfiguration.type === MediaAssetSearchType.TV_EPISODE
    ) {
      graphQLQueryRoot = "dionysus_tv_episodes_by_pk";
    }

    const verifyQuery = gql`
      query VerifyMedia($id: numeric!) {
        ${graphQLQueryRoot}(id: $id) {
          id
          ${
            request.searchConfiguration.type === MediaAssetSearchType.MOVIE ||
            request.searchConfiguration.type === MediaAssetSearchType.TV_EPISODE
              ? `asset {
            ${BASE_MEDIA_ASSET}
          }`
              : ""
          }
        }
      }
    `;

    const verifyResponse =
      await this.graphQLClient.request<GraphQlVerifyMediaResponse>(
        verifyQuery,
        {
          id: request.searchConfiguration.mediaId,
        },
      );

    if (!verifyResponse[graphQLQueryRoot]?.id) {
      throw new BadRequestException(
        "Source media definition could not be found",
      );
    }

    const assetExists = verifyResponse[graphQLQueryRoot]?.asset;

    const insertRequest = gql`
      mutation CreateMediaAssetSearchConfiguration(
        $assetType: String!
        $mediaId: numeric!
        $seriesId: numeric
        $seasonNumber: numeric
        $episodeNumber: numeric
        $backoff: numeric!
        $enabled: Boolean!
        $jitter: numeric!
        $status: String!
        $nextExecutionTime: timestamptz!
      ) {
        insert_dionysus_media_asset_search_configuration_one(
          object: {
            assetType: $assetType
            mediaId: $mediaId
            seriesId: $seriesId
            seasonNumber: $seasonNumber
            episodeNumber: $episodeNumber
            backoff: $backoff
            enabled: $enabled
            jitter: $jitter
            status: $status
            nextExecutionTime: $nextExecutionTime
          }
        ) {
          ${BASE_DECORATED_SEARCH_CONFIGURATION}
        }
      }
    `;

    let nextExecutionTime = moment.utc();

    // Defer execution of the search for a movie or TV episode.  If the search is for a TV series or TV season
    // execute immediately in order to propagate the search status.
    if (
      request.searchConfiguration.type === MediaAssetSearchType.MOVIE ||
      request.searchConfiguration.type === MediaAssetSearchType.TV_EPISODE
    )
      nextExecutionTime = nextExecutionTime.add(
        Math.floor(Math.random() * request.searchConfiguration.jitter),
        "minutes",
      );

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetSearchConfigurationResponse>(
        insertRequest,
        {
          assetType: request.searchConfiguration.type,
          mediaId: request.searchConfiguration.mediaId,
          seriesId: request.searchConfiguration.seriesId,
          seasonNumber: request.searchConfiguration.seasonNumber,
          episodeNumber: request.searchConfiguration.episodeNumber,
          backoff: request.searchConfiguration.backoff,
          enabled: assetExists ? false : request.searchConfiguration.enabled,
          jitter: request.searchConfiguration.jitter,
          status: request.searchConfiguration.status,
          nextExecutionTime: nextExecutionTime.toISOString(),
        },
      );

    const createdSearchConfiguration: DecoratedMediaAssetSearchConfiguration =
      toDecoratedDomainObject(
        insertResponse.insert_dionysus_media_asset_search_configuration_one,
      );

    if (
      createdSearchConfiguration.type === MediaAssetSearchType.TV_SERIES ||
      createdSearchConfiguration.type === MediaAssetSearchType.TV_SEASON
    ) {
      await this.amqpConnection.publish(
        "search.execution.trigger",
        `jobType.${createdSearchConfiguration.type}`,
        {
          mediaId: createdSearchConfiguration.mediaId,
        },
        {
          persistent: true,
          headers: {
            "x-delay": 0,
          },
        },
      );
    }

    const responseBody: SingleMediaAssetSearchConfigurationResponse = {
      searchConfiguration: createdSearchConfiguration,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/media/searchConfiguration/${createdSearchConfiguration.type}/${encodeURIComponent(
          createdSearchConfiguration.mediaId,
        )}`,
      )
      .send(responseBody);
  }
}
