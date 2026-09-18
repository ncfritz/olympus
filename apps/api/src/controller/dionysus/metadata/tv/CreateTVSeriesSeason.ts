import {
  CreateTVSeasonRequest,
  CreateTVSeasonResponse,
  PartialTVSeasonCastMemberRoleWithKey,
  PartialTVSeasonCrewMemberJobWithKey,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlCreateTVSeasonResponse = {
  insert_dionysus_tv_seasons_one: {
    id: number;
    seasonNumber: number;
    seriesId: number;
  };
};

@Controller({ version: "1" })
export class CreateTVSeriesSeasonController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/metadata/tvSeries/:seriesId/seasons")
  @ApiOperation({
    summary: "Upserts a TV series season",
    description: "Creates or updates a TV series season.",
    operationId: "CreateTVSeriesSeason",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateTVSeasonRequest,
    required: true,
    description: "Input for the CreateTVSeriesSeason operation",
  })
  @ApiCreatedResponse({
    type: CreateTVSeasonResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created TV series",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("seriesId") seriesId: number,
    @Body() request: CreateTVSeasonRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateTVSeason(
        $id: numeric!
        $seriesId: numeric!
        $airDate: String
        $name: String!
        $overview: String
        $posterPath: String
        $seasonNumber: numeric!
        $voteAverage: numeric
        $cast: [dionysus_tv_season_cast_insert_input!]!
        $crew: [dionysus_tv_season_crew_insert_input!]!
        $externalIds: [dionysus_tv_season_external_ids_insert_input!]!
        $images: [dionysus_tv_season_images_insert_input!]!
        $videos: [dionysus_tv_season_videos_insert_input!]!
        $castRoles: [dionysus_tv_season_cast_roles_insert_input!]!
        $crewJobs: [dionysus_tv_season_crew_jobs_insert_input!]!
      ) {
        insert_dionysus_tv_seasons_one(
          object: {
            id: $id
            seriesId: $seriesId
            airDate: $airDate
            name: $name
            overview: $overview
            posterPath: $posterPath
            seasonNumber: $seasonNumber
            voteAverage: $voteAverage
            cast: {
              on_conflict: {
                constraint: tv_season_cast_pkey
                update_columns: [order, originalName, totalEpisodeCount]
              }
              data: $cast
            }
            crew: {
              on_conflict: {
                constraint: tv_season_crew_pkey
                update_columns: [originalName, totalEpisodeCount]
              }
              data: $crew
            }
            externalIds: {
              on_conflict: {
                constraint: tv_season_external_ids_pkey
                update_columns: [externalId]
              }
              data: $externalIds
            }
            images: {
              on_conflict: {
                constraint: tv_season_images_pkey
                update_columns: [width, height, languageCode]
              }
              data: $images
            }
            videos: {
              on_conflict: {
                constraint: tv_season_videos_pkey
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
            constraint: tv_seasons_pkey
            update_columns: [
              airDate
              name
              overview
              posterPath
              seasonNumber
              voteAverage
            ]
          }
        ) {
          id
          seasonNumber
          seriesId
        }
        insert_dionysus_tv_season_crew_jobs(
          objects: $crewJobs
          on_conflict: {
            constraint: tv_season_crew_jobs_pkey
            update_columns: [job, episodeCount]
          }
        ) {
          affected_rows
        }
        insert_dionysus_tv_season_cast_roles(
          objects: $castRoles
          on_conflict: {
            constraint: tv_season_cast_roles_pkey
            update_columns: [character, episodeCount]
          }
        ) {
          affected_rows
        }
      }
    `;

    const castRoles: Set<PartialTVSeasonCastMemberRoleWithKey> = new Set();
    const cast = request.season.cast.map((castEntry) => {
      castEntry.roles?.forEach((entry) => {
        castRoles.add({
          personId: castEntry.personId,
          seriesId: seriesId,
          seasonId: request.season.id,
          creditId: entry.creditId,
          character: entry.character,
          episodeCount: entry.episodeCount,
        });
      });

      delete castEntry.roles;
      return castEntry;
    });

    const crewJobs: Set<PartialTVSeasonCrewMemberJobWithKey> = new Set();
    const crew = request.season.crew.map((crewEntry) => {
      crewEntry.jobs?.forEach((entry) => {
        crewJobs.add({
          personId: crewEntry.personId,
          seriesId: seriesId,
          seasonId: request.season.id,
          creditId: entry.creditId,
          job: entry.job,
          episodeCount: entry.episodeCount,
        });
      });

      delete crewEntry.jobs;
      return crewEntry;
    });

    const variables = {
      id: request.season.id,
      seriesId: seriesId,
      seasonNumber: request.season.seasonNumber,
      airDate: request.season.airDate,
      name: request.season.name,
      overview: request.season.overview,
      posterPath: request.season.posterPath,
      voteAverage: request.season.voteAverage,
      cast: cast,
      crew: crew,
      externalIds: request.season.externalIds,
      images: request.season.images,
      videos: request.season.videos,
      castRoles: [...castRoles],
      crewJobs: [...crewJobs],
    };

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateTVSeasonResponse>(
        insertRequest,
        variables,
      );

    const responseBody: CreateTVSeasonResponse = {
      seasonId: insertResponse.insert_dionysus_tv_seasons_one.id,
      seasonNumber: insertResponse.insert_dionysus_tv_seasons_one.seasonNumber,
      seriesId: insertResponse.insert_dionysus_tv_seasons_one.seriesId,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api//metdata/tvSeries/${seriesId}/season/${request.season.seasonNumber}`,
      )
      .send(responseBody);
  }
}
