import { DescribeTVSeasonResponse, Season } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/metadata/tvSeasonConverter";
import { MEDIA_ASSET } from "../../../../query/dionysus/media/mediaAsset";
import { SEARCH_CONFIGURATION } from "../../../../query/dionysus/media/searchConfigutation";
import { GraphQlTvSeason } from "../../../../types/dionysus/metadata/tvSeason";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetTvSeasonResponse = {
  dionysus_tv_seasons: GraphQlTvSeason[];
};

@Controller({ version: "1" })
export class DescribeTvSeasonController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber")
  @ApiOperation({
    summary: "Describes a TV season in Dionysus",
    description: "Retrieves the details of a TV season in Dionysus.",
    operationId: "DescribeTvSeason",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    description: "The ID of the TV series the season is associated with",
    type: Number,
  })
  @ApiParam({
    name: "seasonNumber",
    description: "The season number to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeTVSeasonResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId") tvSeriesId: number,
    @Param("seasonNumber") seasonNumber: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeTvSeason($seriesId: numeric!, $seasonNumber: numeric!) {
        dionysus_tv_seasons(
          where: {
            _and: {
              seriesId: { _eq: $seriesId }
              seasonNumber: { _eq: $seasonNumber }
            }
          }
        ) {
          airDate
          createdTime
          id
          lastUpdatedTime
          name
          overview
          posterPath
          seasonNumber
          voteAverage
          episodes_aggregate {
            aggregate {
              count
            }
          }
          externalIds {
            createdTime
            externalId
            lastUpdatedTime
            type
          }
          videos {
            country {
              createdTime
              id
              lastUpdatedTime
              name
            }
            createdTime
            id
            key
            language {
              createdTime
              lastUpdatedTime
              id
              name
              nativeName
            }
            lastUpdatedTime
            name
            official
            publishedDate
            site
            size
            type
          }
          images {
            createdTime
            filePath
            height
            language {
              createdTime
              id
              lastUpdatedTime
              name
              nativeName
            }
            lastUpdatedTime
            type
            width
          }
          episodes(order_by: { episodeNumber: asc }) {
            airDate
            createdTime
            episodeNumber
            id
            lastUpdatedTime
            name
            overview
            productionCode
            runtime
            seasonNumber
            stillPath
            voteCount
            voteAverage
            ${SEARCH_CONFIGURATION}
            ${MEDIA_ASSET}
          }
          series {
            adult
            backdropPath
            createdTime
            firstAirDate
            homepage
            id
            inProduction
            lastAirDate
            lastEpisodeToAirId
            lastUpdatedTime
            name
            numberOfEpisodes
            numberOfSeasons
            originalName
            original_language
            overview
            posterPath
            status
            tagline
            type
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeasonResponse>(
        fetchRequest,
        {
          seriesId: tvSeriesId,
          seasonNumber: seasonNumber,
        },
      );

    if (
      !fetchResponse.dionysus_tv_seasons ||
      fetchResponse.dionysus_tv_seasons.length <= 0
    ) {
      throw new NotFoundException();
    }

    const fetchedTvSeason: Season = toDomainObject(
      fetchResponse.dionysus_tv_seasons[0],
    );

    const responseBody: DescribeTVSeasonResponse = {
      season: fetchedTvSeason,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
