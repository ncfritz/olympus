import {
  CreateTVEpisodeRequest,
  CreateTVEpisodeResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeTvEpisodeController } from "./DescribeTvEpisode";
import { setLocation } from "../../../../utils/location";

type GraphQlCreateTVEpisodeResponse = {
  insert_dionysus_tv_episodes_one: {
    id: number;
    episodeNumber: number;
    seasonId: number;
    seasonNumber: number;
    seriesId: number;
  };
};

@Controller({ version: "1" })
export class CreateTVSeriesEpisodeController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/metadata/tvSeries/:seriesId/season/:seasonNumber/episodes")
  @ApiOperation({
    summary: "Upserts a TV series episode",
    description: "Creates or updates a TV series episode.",
    operationId: "CreateTVSeriesEpisode",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateTVEpisodeRequest,
    required: true,
    description: "Input for the CreateTVSeriesEpisode operation",
  })
  @ApiCreatedResponse({
    type: CreateTVEpisodeResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created TV episode",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("seriesId", ParseIntPipe) seriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,
    @Body() request: CreateTVEpisodeRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateTVSeriesEpisode(
        $id: numeric!
        $seasonId: numeric!
        $seriesId: numeric!
        $airDate: String
        $episodeNumber: numeric!
        $name: String!
        $overview: String
        $productionCode: String!
        $seasonNumber: numeric!
        $runtime: numeric
        $stillPath: String
        $voteCount: numeric
        $voteAverage: numeric
        $cast: [dionysus_tv_episode_cast_insert_input!]!
        $crew: [dionysus_tv_episode_crew_insert_input!]!
        $externalIds: [dionysus_tv_episode_external_ids_insert_input!]!
        $guestStars: [dionysus_tv_episode_guest_stars_insert_input!]!
        $images: [dionysus_tv_episode_images_insert_input!]!
        $videos: [dionysus_tv_episode_videos_insert_input!]!
      ) {
        insert_dionysus_tv_episodes_one(
          object: {
            id: $id
            seasonId: $seasonId
            seriesId: $seriesId
            airDate: $airDate
            episodeNumber: $episodeNumber
            productionCode: $productionCode
            name: $name
            overview: $overview
            runtime: $runtime
            seasonNumber: $seasonNumber
            stillPath: $stillPath
            voteCount: $voteCount
            voteAverage: $voteAverage
            cast: {
              on_conflict: {
                constraint: tv_episode_cast_pkey
                update_columns: [personId, order]
              }
              data: $cast
            }
            crew: {
              on_conflict: {
                constraint: tv_episode_crew_pkey
                update_columns: [personId, originalName, department, job]
              }
              data: $crew
            }
            externalIds: {
              on_conflict: {
                constraint: tv_episode_external_ids_pkey
                update_columns: [externalId, type]
              }
              data: $externalIds
            }
            guestStars: {
              on_conflict: {
                constraint: tv_episode_guest_stars_pkey
                update_columns: [
                  creditId
                  personId
                  originalName
                  order
                  character
                ]
              }
              data: $guestStars
            }
            images: {
              on_conflict: {
                constraint: tv_episode_images_pkey
                update_columns: [width, height, languageCode]
              }
              data: $images
            }
            videos: {
              on_conflict: {
                constraint: tv_episode_videos_pkey
                update_columns: [
                  languageCode
                  countryCode
                  name
                  key
                  site
                  size
                  type
                  official
                  publishedDate
                ]
              }
              data: $videos
            }
          }
          on_conflict: {
            constraint: tv_episodes_pkey
            update_columns: [
              airDate
              name
              episodeNumber
              overview
              stillPath
              seasonNumber
              voteCount
              voteAverage
            ]
          }
        ) {
          id
          episodeNumber
          seasonId
          seasonNumber
          seriesId
        }
      }
    `;

    const variables = {
      id: request.episode.id,
      seriesId: seriesId,
      seasonId: request.episode.seasonId,
      airDate: request.episode.airDate,
      episodeNumber: request.episode.episodeNumber,
      name: request.episode.name,
      overview: request.episode.overview,
      productionCode: request.episode.productionCode,
      stillPath: request.episode.stillPath,
      seasonNumber: seasonNumber,
      cast: request.episode.cast,
      crew: request.episode.crew,
      images: request.episode.images,
      guestStars: request.episode.guestStars,
      videos: request.episode.videos,
      externalIds: request.episode.externalIds,
      voteCount: request.episode.voteCount,
      voteAverage: request.episode.voteAverage,
    };

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateTVEpisodeResponse>(
        insertRequest,
        variables,
      );

    const responseBody: CreateTVEpisodeResponse = {
      episodeId: insertResponse.insert_dionysus_tv_episodes_one.id,
      episodeNumber:
        insertResponse.insert_dionysus_tv_episodes_one.episodeNumber,
      seasonId: insertResponse.insert_dionysus_tv_episodes_one.seasonId,
      seasonNumber: insertResponse.insert_dionysus_tv_episodes_one.seasonNumber,
      seriesId: insertResponse.insert_dionysus_tv_episodes_one.seriesId,
    };

    setLocation(response, httpRequest, DescribeTvEpisodeController, {
      tvSeriesId: seriesId,
      seasonNumber,
      episodeNumber: request.episode.episodeNumber,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
