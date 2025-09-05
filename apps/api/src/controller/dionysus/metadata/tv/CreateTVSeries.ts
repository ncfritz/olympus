import {
  CreateTVSeriesRequest,
  CreateTVSeriesResponse,
  PartialTVSeriesCastMemberRoleWithKey,
  PartialTVSeriesCrewMemberJobWithKey,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlCreateTVSeriesResponse = {
  insert_dionysus_tv_series_one: {
    id: number;
  };
};

@Controller({ version: "1" })
export class CreateTVSeriesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/metadata/tvSeries")
  @ApiOperation({
    summary: "Upserts a TV series",
    description: "Creates or updates a TV series.",
    operationId: "CreateTVSeries",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateTVSeriesRequest,
    required: true,
    description: "Input for the CreateTVSeries operation",
  })
  @ApiCreatedResponse({
    type: CreateTVSeriesResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        description: "The location of the created TV series",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateTVSeriesRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateTVSeries(
        $id: numeric!
        $adult: Boolean!
        $backdropPath: String
        $firstAirDate: String
        $homepage: String
        $inProduction: Boolean!
        $lastAirDate: String
        $lastEpisodeToAirId: numeric
        $name: String!
        $nextEpisodeToAirId: numeric
        $numberOfEpisodes: numeric
        $numberOfSeasons: numeric
        $originalName: String!
        $original_language: String!
        $overview: String
        $popularity: numeric
        $posterPath: String
        $status: String!
        $tagline: String
        $type: String!
        $voteAverage: numeric
        $voteCount: numeric
        $alternativeTitles: [dionysus_tv_series_alternative_titles_insert_input!]!
        $cast: [dionysus_tv_series_cast_insert_input!]!
        $createdBy: [dionysus_tv_series_created_by_insert_input!]!
        $certifications: [dionysus_tv_series_content_ratings_insert_input!]!
        $crew: [dionysus_tv_series_crew_insert_input!]!
        $episodeRunTimes: [dionysus_tv_series_episode_run_times_insert_input!]!
        $externalIds: [dionysus_tv_series_external_ids_insert_input!]!
        $genres: [dionysus_tv_series_genres_insert_input!]!
        $images: [dionysus_tv_series_images_insert_input!]!
        $keywords: [dionysus_tv_series_keywords_insert_input!]!
        $languages: [dionysus_tv_series_languages_insert_input!]!
        $networks: [dionysus_tv_series_networks_insert_input!]!
        $originCountries: [dionysus_tv_series_origin_countries_insert_input!]!
        $productionCompanies: [dionysus_tv_series_production_companies_insert_input!]!
        $productionCountries: [dionysus_tv_series_production_countries_insert_input!]!
        $recommendations: [dionysus_tv_series_recommendations_insert_input!]!
        $spokenLanguages: [dionysus_tv_series_spoken_languages_insert_input!]!
        $videos: [dionysus_tv_series_videos_insert_input!]!
        $castRoles: [dionysus_tv_series_cast_roles_insert_input!]!
        $crewJobs: [dionysus_tv_series_crew_jobs_insert_input!]!
      ) {
        insert_dionysus_tv_series_one(
          object: {
            id: $id
            adult: $adult
            backdropPath: $backdropPath
            firstAirDate: $firstAirDate
            homepage: $homepage
            inProduction: $inProduction
            lastAirDate: $lastAirDate
            lastEpisodeToAirId: $lastEpisodeToAirId
            name: $name
            nextEpisodeToAirId: $nextEpisodeToAirId
            numberOfEpisodes: $numberOfEpisodes
            numberOfSeasons: $numberOfSeasons
            originalName: $originalName
            original_language: $original_language
            overview: $overview
            popularity: $popularity
            posterPath: $posterPath
            status: $status
            tagline: $tagline
            type: $type
            voteAverage: $voteAverage
            voteCount: $voteCount
            alternativeTitles: {
              on_conflict: {
                constraint: tv_series_alternative_titles_pkey
                update_columns: [title, type, countryCode]
              }
              data: $alternativeTitles
            }
            cast: {
              on_conflict: {
                constraint: tv_series_cast_pkey
                update_columns: [order, originalName, totalEpisodeCount]
              }
              data: $cast
            }
            certifications: {
              on_conflict: {
                constraint: tv_series_content_ratings_pkey
                update_columns: [seriesId]
              }
              data: $certifications
            }
            createdBy: {
              on_conflict: {
                constraint: tv_series_created_by_pkey
                update_columns: [seriesId]
              }
              data: $createdBy
            }
            crew: {
              on_conflict: {
                constraint: tv_series_crew_pkey
                update_columns: [originalName, totalEpisodeCount]
              }
              data: $crew
            }
            episodeRunTimes: {
              on_conflict: {
                constraint: tv_series_episode_run_times_pkey
                update_columns: [runTime]
              }
              data: $episodeRunTimes
            }
            externalIds: {
              on_conflict: {
                constraint: tv_series_external_ids_pkey
                update_columns: [externalId]
              }
              data: $externalIds
            }
            genres: {
              on_conflict: {
                constraint: tv_series_genres_pkey
                update_columns: [genreId]
              }
              data: $genres
            }
            images: {
              on_conflict: {
                constraint: tv_series_images_pkey
                update_columns: [width, height, languageCode]
              }
              data: $images
            }
            keywords: {
              on_conflict: {
                constraint: tv_series_keywords_pkey
                update_columns: [keywordId]
              }
              data: $keywords
            }
            languages: {
              on_conflict: {
                constraint: tv_series_languages_pkey
                update_columns: [languageCode]
              }
              data: $languages
            }
            networks: {
              on_conflict: {
                constraint: tv_series_networks_pkey
                update_columns: [networkId]
              }
              data: $networks
            }
            originCountries: {
              on_conflict: {
                constraint: tv_series_origin_countries_pkey
                update_columns: [countryCode]
              }
              data: $originCountries
            }
            productionCompanies: {
              on_conflict: {
                constraint: tv_series_production_companies_pkey
                update_columns: [productionCompanyId]
              }
              data: $productionCompanies
            }
            productionCountries: {
              on_conflict: {
                constraint: tv_series_production_countries_pkey
                update_columns: [countryCode]
              }
              data: $productionCountries
            }
            recommendations: { data: $recommendations }
            spokenLanguages: {
              on_conflict: {
                constraint: tv_series_spoken_languages_pkey
                update_columns: [languageCode]
              }
              data: $spokenLanguages
            }
            videos: {
              on_conflict: {
                constraint: tv_series_videos_pkey
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
            constraint: tv_series_pkey
            update_columns: [
              adult
              backdropPath
              firstAirDate
              homepage
              inProduction
              lastAirDate
              lastEpisodeToAirId
              nextEpisodeToAirId
              name
              numberOfEpisodes
              numberOfSeasons
              originalName
              original_language
              overview
              popularity
              posterPath
              status
              tagline
              type
              voteAverage
              voteCount
            ]
          }
        ) {
          id
        }
        insert_dionysus_tv_series_crew_jobs(
          objects: $crewJobs
          on_conflict: {
            constraint: tv_series_crew_jobs_pkey
            update_columns: [job, episodeCount]
          }
        ) {
          affected_rows
        }
        insert_dionysus_tv_series_cast_roles(
          objects: $castRoles
          on_conflict: {
            constraint: tv_series_cast_roles_pkey
            update_columns: [character, episodeCount]
          }
        ) {
          affected_rows
        }
      }
    `;

    const castRoles: Set<PartialTVSeriesCastMemberRoleWithKey> = new Set();
    const cast = request.tvSeries.cast.map((castEntry) => {
      castEntry.roles?.forEach((entry) => {
        castRoles.add({
          personId: castEntry.personId,
          seriesId: request.tvSeries.id,
          creditId: entry.creditId,
          character: entry.character,
          episodeCount: entry.episodeCount,
        });
      });

      delete castEntry.roles;
      return castEntry;
    });

    const crewJobs: Set<PartialTVSeriesCrewMemberJobWithKey> = new Set();
    const crew = request.tvSeries.crew.map((crewEntry) => {
      crewEntry.jobs?.forEach((entry) => {
        crewJobs.add({
          personId: crewEntry.personId,
          seriesId: request.tvSeries.id,
          creditId: entry.creditId,
          job: entry.job,
          episodeCount: entry.episodeCount,
        });
      });

      delete crewEntry.jobs;
      return crewEntry;
    });

    const variables = {
      id: request.tvSeries.id,
      adult: request.tvSeries.adult,
      backdropPath: request.tvSeries.backdropPath,
      firstAirDate: request.tvSeries.firstAirDate,
      homepage: request.tvSeries.homepage,
      inProduction: request.tvSeries.inProduction,
      lastAirDate: request.tvSeries.lastAirDate,
      lastEpisodeToAirId: request.tvSeries.lastEpisodeToAirId,
      name: request.tvSeries.name,
      numberOfEpisodes: request.tvSeries.numberOfEpisodes || 0,
      numberOfSeasons: request.tvSeries.numberOfSeasons || 0,
      originalName: request.tvSeries.originalName,
      original_language: request.tvSeries.originalLanguageCode,
      overview: request.tvSeries.overview,
      popularity: request.tvSeries.popularity,
      posterPath: request.tvSeries.posterPath,
      status: request.tvSeries.status,
      tagline: request.tvSeries.tagline,
      type: request.tvSeries.type,
      voteAverage: request.tvSeries.voteAverage,
      voteCount: request.tvSeries.voteCount,
      alternativeTitles: request.tvSeries.alternativeTitles,
      cast: cast,
      certifications: request.tvSeries.certifications,
      createdBy: request.tvSeries.createdBy,
      crew: crew,
      episodeRunTimes: request.tvSeries.runtimes,
      externalIds: request.tvSeries.externalIds,
      genres: request.tvSeries.genres,
      images: request.tvSeries.images,
      keywords: request.tvSeries.keywords,
      languages: request.tvSeries.languages,
      networks: request.tvSeries.networks,
      originCountries: request.tvSeries.originCountries,
      productionCompanies: request.tvSeries.productionCompanies,
      productionCountries: request.tvSeries.productionCountries,
      recommendations: request.tvSeries.recommendations,
      spokenLanguages: request.tvSeries.spokenLanguages,
      videos: request.tvSeries.videos,
      castRoles: [...castRoles],
      crewJobs: [...crewJobs],
    };

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateTVSeriesResponse>(
        insertRequest,
        variables,
      );

    const responseBody: CreateTVSeriesResponse = {
      seriesId: insertResponse.insert_dionysus_tv_series_one.id,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api//metdata/tvSeries/${insertResponse.insert_dionysus_tv_series_one.id}`,
      )
      .send(responseBody);
  }
}
