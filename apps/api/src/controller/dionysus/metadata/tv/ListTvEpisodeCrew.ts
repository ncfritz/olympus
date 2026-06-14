import {
  ListTVEpisodeCrewResponse,
  TVEpisodeCrewMember,
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
import { toTvEpisodeCrewMember } from "../../../../convert/dionysus/metadata/tvEpisodeConverter";
import { BASE_TV_EPISODE_CREW_MEMBER } from "../../../../query/dionysus/metadata/tvSeries";
import { GraphQlTvEpisodeCrewMember } from "../../../../types/dionysus/metadata/tvEpisode";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseTVController } from "./BaseTVController";

type GraphQlListTvEpisodeCrewResponse = {
  dionysus_tv_episode_crew: GraphQlTvEpisodeCrewMember[];
};

@Controller({ version: "1" })
export class ListTvEpisodeCrewController extends BaseTVController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Get(
    "/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber/episodes/:episodeNumber/crew",
  )
  @ApiOperation({
    summary: "Lists TV episode crew members",
    description:
      "Lists the full crew for a TV episode.  This API is not paginated and does not support filtering.",
    operationId: "ListTvEpisodeCrew",
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
    type: ListTVEpisodeCrewResponse,
    description: "The list of TV episode crew members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId") tvSeriesId: number,
    @Param("seasonNumber") seasonNumber: number,
    @Param("episodeNumber") episodeNumber: number,
    @Res() response: Response,
  ): Promise<void> {
    const episodeId = await this.lookupMediaIdForTvEpisode(
      tvSeriesId,
      seasonNumber,
      episodeNumber,
    );

    const fetchRequest = gql`
      query ListTvEpisodeCrewMembers($episodeId: numeric!) {
        dionysus_tv_episode_crew(where: { episodeId: { _eq: $episodeId } }) {
          ${BASE_TV_EPISODE_CREW_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvEpisodeCrewResponse>(
        fetchRequest,
        { episodeId: episodeId },
      );
    const crew: TVEpisodeCrewMember[] = [];

    fetchResponse.dionysus_tv_episode_crew.forEach((result) => {
      if (result.person) {
        crew.push(toTvEpisodeCrewMember(result));
      }
    });

    const responseBody: ListTVEpisodeCrewResponse = {
      crew: crew,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
