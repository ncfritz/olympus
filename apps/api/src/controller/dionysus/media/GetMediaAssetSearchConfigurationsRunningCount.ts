import {
  FilterDefinition,
  FilterType,
  GetMediaAssetSearchConfigurationsRunningCountResponse,
  MediaAssetSearchConfigurationStatus,
  MediaAssetSearchType,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
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
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { buildFilterExpression } from "../../../utils/filterUtil";

type GraphQlCountMediaAssetSearchConfigurationsResponse = {
  dionysus_media_asset_search_configuration_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class GetMediaAssetSearchConfigurationsRunningCountController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/media/searchConfiguration/:mediaType/:mediaId/running")
  @ApiOperation({
    summary:
      "Gets the number of search configurations that are marked as running for a TV series or season",
    description:
      "Gets the count of search configurations that are marked as `running` for a given TV series or season.",
    operationId: "GetMediaAssetSearchConfigurationsRunningCount",
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
  @ApiQuery({
    name: "seasonNumber",
    description:
      "The season number, if the initially triggered search targeted a specific season.",
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "The count has been successfully fetched.",
    type: GetMediaAssetSearchConfigurationsRunningCountResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
    @Query("seasonNumber") seasonNumber: number | undefined = undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (
      ![
        MediaAssetSearchType.TV_SERIES,
        MediaAssetSearchType.TV_SEASON,
      ].includes(mediaType)
    ) {
      throw new BadRequestException("mediatype must be tv_series or tv_season");
    }

    let targetTypes: MediaAssetSearchType[] = [];
    const filters: FilterDefinition[] = [
      {
        type: FilterType.EQUALS,
        name: "status",
        value: MediaAssetSearchConfigurationStatus.UPDATING,
      },
      {
        type: FilterType.EQUALS,
        name: "seriesId",
        value: mediaId,
      },
    ];

    if (mediaType === MediaAssetSearchType.TV_SERIES) {
      targetTypes = [
        MediaAssetSearchType.TV_SEASON,
        MediaAssetSearchType.TV_EPISODE,
      ];
    } else if (mediaType === MediaAssetSearchType.TV_SEASON) {
      if (!seasonNumber) {
        throw new BadRequestException("seasonNumber must be provided");
      }

      filters.push({
        type: FilterType.EQUALS,
        name: "seasonNumber",
        value: seasonNumber!,
      });
      targetTypes = [MediaAssetSearchType.TV_EPISODE];
    }

    const filter: FilterDefinition = {
      type: FilterType.AND,
      name: "_",
      value: [
        ...filters,
        {
          type: FilterType.IN,
          name: "assetType",
          value: targetTypes,
        },
      ],
    };

    const countRequest = gql`
      query GetSearchConfigurationsCount {
        dionysus_media_asset_search_configuration_aggregate(${buildFilterExpression(filter)}) {
          aggregate {
            count
          }
        }
      }
    `;

    const countResponse =
      await this.graphQLClient.request<GraphQlCountMediaAssetSearchConfigurationsResponse>(
        countRequest,
      );

    const responseBody: GetMediaAssetSearchConfigurationsRunningCountResponse =
      {
        count:
          countResponse.dionysus_media_asset_search_configuration_aggregate
            .aggregate.count,
      };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
