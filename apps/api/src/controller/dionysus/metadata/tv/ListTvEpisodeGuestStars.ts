import {
  ListTVEpisodeGuestStarsResponse,
  TVEpisodeCastMember,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toTvEpisodeCastMember } from "../../../../convert/dionysus/metadata/tvEpisodeConverter";
import { TV_EPISODE_CAST_MEMBER } from "../../../../query/dionysus/metadata/tvEpisode";
import { GraphQlTvEpisodeCastMember } from "../../../../types/dionysus/metadata/tvEpisode";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseTVController } from "./BaseTVController";

type GraphQlListTvEpisodeCastResponse = {
  dionysus_tv_episode_guest_stars: GraphQlTvEpisodeCastMember[];
};

@Controller({ version: "1" })
export class ListTvEpisodeGuestStarsController extends BaseTVController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Get(
    "/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber/episodes/:episodeNumber/guestStars",
  )
  @ApiOperation({
    summary: "Lists TV episode guest stars",
    description:
      "Lists the guest stars for a TV episode.  This API is not paginated and does not support filtering.",
    operationId: "ListTvEpisodeGuestStars",
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
    type: ListTVEpisodeGuestStarsResponse,
    description: "The list of TV episode guest stars.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId") tvSeriesId: number,
    @Param("seasonNumber") seasonNumber: number,
    @Param("episodeNumber") episodeNumber: number,
    @Res() response: Response,
  ): Promise<void> {
    const episodeId = this.lookupMediaIdForTvEpisode(
      tvSeriesId,
      seasonNumber,
      episodeNumber,
    );

    const fetchRequest = gql`
      query ListTvEpisodeGuestStars($episodeId: numeric!) {
        dionysus_tv_episode_guest_stars(
          where: { episodeId: { _eq: $episodeId } }
        ) {
          ${TV_EPISODE_CAST_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvEpisodeCastResponse>(
        fetchRequest,
        { episodeId: episodeId },
      );
    const guestStars: TVEpisodeCastMember[] = [];

    fetchResponse.dionysus_tv_episode_guest_stars.forEach((result) => {
      if (result.person) {
        guestStars.push(toTvEpisodeCastMember(result));
      }
    });

    const responseBody: ListTVEpisodeGuestStarsResponse = {
      guestStars: guestStars,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
