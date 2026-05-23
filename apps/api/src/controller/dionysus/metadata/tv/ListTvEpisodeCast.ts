import {
  ListTVEpisodeCastResponse,
  TVEpisodeCastMember,
} from "@ncfritz/olympus-model";
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
import { toTvEpisodeCastMember } from "../../../../convert/dionysus/metadata/tvEpisodeConverter";
import { GraphQlTvEpisodeCastMember } from "../../../../types/dionysus/metadata/tvEpisode";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlTvEpisodeIdLookupResponse = {
  dionysus_tv_episodes: {
    id: number;
  }[];
};
type GraphQlListTvEpisodeCastResponse = {
  dionysus_tv_episode_cast: GraphQlTvEpisodeCastMember[];
};

@Controller({ version: "1" })
export class ListTvEpisodeCastController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get(
    "/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber/episodes/:episodeNumber/cast",
  )
  @ApiOperation({
    summary: "Lists TV episode cast members",
    description:
      "Lists the full cast for a TV episode.  This API is not paginated and does not support filtering.",
    operationId: "ListTvEpisodeCast",
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
    type: ListTVEpisodeCastResponse,
    description: "The list of TV episode cast members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId") tvSeriesId: number,
    @Param("seasonNumber") seasonNumber: number,
    @Param("episodeNumber") episodeNumber: number,
    @Res() response: Response,
  ): Promise<void> {
    const seasonIdLookupRequest = gql`
      query LookupTvEpisodeId(
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
          id
        }
      }
    `;

    const tvSeriesIdFetchResponse =
      await this.graphQLClient.request<GraphQlTvEpisodeIdLookupResponse>(
        seasonIdLookupRequest,
        {
          seriesId: tvSeriesId,
          seasonNumber: seasonNumber,
          episodeNumber: episodeNumber,
        },
      );

    if (tvSeriesIdFetchResponse.dionysus_tv_episodes.length <= 0) {
      throw new NotFoundException();
    }

    const episodeId = tvSeriesIdFetchResponse.dionysus_tv_episodes[0].id;

    const fetchRequest = gql`
      query ListTvEpisodeCastMembers($episodeId: numeric!) {
        dionysus_tv_episode_cast(where: { episodeId: { _eq: $episodeId } }) {
          createdTime
          creditId
          character
          lastUpdatedTime
          originalName
          person {
            adult
            birthday
            birthplace
            createdTime
            gender
            homepage
            id
            imdbId
            knownForDepartment
            lastUpdatedTime
            name
            profilePath
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvEpisodeCastResponse>(
        fetchRequest,
        { episodeId: episodeId },
      );
    const cast: TVEpisodeCastMember[] = [];

    fetchResponse.dionysus_tv_episode_cast.forEach((result) => {
      if (result.person) {
        cast.push(toTvEpisodeCastMember(result));
      }
    });

    const responseBody: ListTVEpisodeCastResponse = {
      cast: cast,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
