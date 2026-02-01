import { DescribeTVEpisodeResponse, Episode } from "@ncfritz/olympus-model";
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
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/metadata/tvEpisodeConverter";
import { SEARCH_CONFIGURATION } from "../../../../query/dionysus/media/searchConfigutation";
import { GraphQlTvEpisode } from "../../../../types/dionysus/metadata/tvEpisode";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetTvEpisodeResponse = {
  dionysus_tv_episodes: GraphQlTvEpisode[];
};

@Controller({ version: "1" })
export class DescribeTvEpisodeController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get(
    "/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber/episodes/:episodeNumber",
  )
  @ApiOperation({
    summary: "Describes a TV episode in Dionysus",
    description: "Retrieves the details of a TV episode in Dionysus.",
    operationId: "DescribeTvEpisode",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    description: "The ID of the TV series the episode is associated with",
    type: Number,
  })
  @ApiParam({
    name: "seasonNumber",
    description: "The season number the episode is part of",
    type: Number,
  })
  @ApiParam({
    name: "episodeNumber",
    description: "The episode number to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeTVEpisodeResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId") tvSeriesId: number,
    @Param("seasonNumber") seasonNumber: number,
    @Param("episodeNumber") episodeNumber: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeTvEpisode(
        $seriesId: numeric!
        $seasonNumber: numeric!
        $episodeNumber: numeric!
      ) {
        dionysus_tv_episodes(
          where: {
            _and: {
              seriesId: { _eq: $seriesId }
              seasonNumber: { _eq: $seasonNumber }
              episodeNumber: { _eq: $episodeNumber }
            }
          }
        ) {
          createdTime
          id
          lastUpdatedTime
          name
          overview
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
          episodeNumber
          airDate
          productionCode
          runtime
          seasonNumber
          stillPath
          voteCount
          voteAverage
          series {
            adult
            backdropPath
            createdTime
            lastAirDate
            inProduction
            id
            firstAirDate
            lastEpisodeToAirId
            lastUpdatedTime
            name
            numberOfEpisodes
            numberOfSeasons
            originalName
            overview
            posterPath
            status
            tagline
            type
          }
          season {
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
            ${SEARCH_CONFIGURATION}
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvEpisodeResponse>(
        fetchRequest,
        {
          seriesId: tvSeriesId,
          seasonNumber: seasonNumber,
          episodeNumber: episodeNumber,
        },
      );

    if (
      !fetchResponse.dionysus_tv_episodes ||
      fetchResponse.dionysus_tv_episodes.length <= 0
    ) {
      throw new NotFoundException();
    }

    const fetchedTvEpisode: Episode = toDomainObject(
      fetchResponse.dionysus_tv_episodes[0],
    );

    const responseBody: DescribeTVEpisodeResponse = {
      episode: fetchedTvEpisode,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
