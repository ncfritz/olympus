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
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/metadata/tvEpisodeConverter";
import { TV_EPISODE } from "../../../../query/dionysus/metadata/tvSeries";
import { GraphQlTvEpisode } from "../../../../types/dionysus/metadata/tvEpisode";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetTvEpisodeResponse = {
  dionysus_tv_episodes_by_pk: GraphQlTvEpisode;
};

@Controller({ version: "1" })
export class GetTvEpisodeByIdController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tvEpisodes/:episodeId")
  @ApiOperation({
    summary: "Describes a TV episode by its ID",
    description: "Retrieves the details of a TV episode by its TMDB ID.",
    operationId: "GetTvEpisodeById",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "episodeId",
    description: "The ID of the TV episode",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeTVEpisodeResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("episodeId") episodeId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query GetTvEpisodeById(
        $episodeId: numeric!
      ) {
        dionysus_tv_episodes_by_pk(id: $episodeId) {
          ${TV_EPISODE}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvEpisodeResponse>(
        fetchRequest,
        {
          episodeId: episodeId,
        },
      );

    if (!fetchResponse.dionysus_tv_episodes_by_pk) {
      throw new NotFoundException();
    }

    const fetchedTvEpisode: Episode = toDomainObject(
      fetchResponse.dionysus_tv_episodes_by_pk,
    );

    const responseBody: DescribeTVEpisodeResponse = {
      episode: fetchedTvEpisode,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
