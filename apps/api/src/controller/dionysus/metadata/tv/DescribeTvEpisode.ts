import { DescribeTVEpisodeResponse, Episode } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
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
import { toDomainObject } from "../../../../convert/dionysus/metadata/tvEpisodeConverter";
import { TV_EPISODE } from "../../../../query/dionysus/metadata/tvSeries";
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
    summary: "Describes a TV episode by series, season and episode number",
    description:
      "Retrieves the details of a TV episode identified by series, season number and episode number.",
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
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,
    @Param("episodeNumber", ParseIntPipe) episodeNumber: number,
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
          ${TV_EPISODE}
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
