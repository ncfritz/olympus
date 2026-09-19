import {
  ListTVEpisodeCastResponse,
  TVEpisodeCastMember,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
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
import { toTvEpisodeCastMember } from "../converters/tvEpisodeConverter";
import { TV_EPISODE_CAST_MEMBER } from "../queries/tvSeries";
import { GraphQlTvEpisodeCastMember } from "../types/tvEpisode";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseTVController } from "./BaseTVController";

type GraphQlListTvEpisodeCastResponse = {
  dionysus_tv_episode_cast: GraphQlTvEpisodeCastMember[];
};

@Controller({ version: "1" })
export class ListTvEpisodeCastController extends BaseTVController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

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
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,
    @Param("episodeNumber", ParseIntPipe) episodeNumber: number,
    @Res() response: Response,
  ): Promise<void> {
    const episodeId = await this.lookupMediaIdForTvEpisode(
      tvSeriesId,
      seasonNumber,
      episodeNumber,
    );

    const fetchRequest = gql`
      query ListTvEpisodeCast($episodeId: numeric!) {
        dionysus_tv_episode_cast(where: { episodeId: { _eq: $episodeId } }) {
          ${TV_EPISODE_CAST_MEMBER}
        }
      }`;

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
