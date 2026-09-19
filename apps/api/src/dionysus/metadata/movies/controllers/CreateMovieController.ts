import {
  CreateMovieRequest,
  CreateMovieResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { GraphQlSparseMovie } from "../types/movie";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeMovieController } from "./DescribeMovieController";
import { setLocation } from "../../../../utils/location";

type GraphQlCreateMovieResponse = {
  insert_dionysus_movies_one: GraphQlSparseMovie;
};

@Controller({ version: "1" })
export class CreateMovieController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/metadata/movies")
  @ApiOperation({
    summary: "Upserts a movie",
    description: "Creates or updates a movie.",
    operationId: "CreateMovie",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMovieRequest,
    required: true,
    description: "Input for the CreateMovie operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateMovieResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created movie1",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateMovieRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateMovie(
        $id: numeric!
        $adult: Boolean!
        $backdropPath: String
        $budget: numeric!
        $homepage: String!
        $imdbId: String
        $originalLanguageCode: String!
        $originalTitle: String!
        $overview: String!
        $popularity: numeric
        $posterPath: String
        $releaseDate: String
        $revenue: numeric!
        $runtime: numeric!
        $status: String!
        $tagline: String!
        $title: String!
        $voteAverage: numeric
        $voteCount: numeric
        $video: Boolean!
        $alternativeTitles: [dionysus_movie_alternative_titles_insert_input!]!
        $cast: [dionysus_movie_cast_insert_input!]!
        $crew: [dionysus_movie_crew_insert_input!]!
        $externalIds: [dionysus_movie_external_ids_insert_input!]!
        $genres: [dionysus_movie_genres_insert_input!]!
        $images: [dionysus_movie_images_insert_input!]!
        $keywords: [dionysus_movie_keywords_insert_input!]!
        $productionCompanies: [dionysus_movie_production_companies_insert_input!]!
        $productionCountries: [dionysus_movie_production_countries_insert_input!]!
        $recommendations: [dionysus_movie_recommendations_insert_input!]!
        $releaseDates: [dionysus_movie_release_dates_insert_input!]!
        $spokenLanguages: [dionysus_movie_spoken_languages_insert_input!]!
        $videos: [dionysus_movie_videos_insert_input!]!
      ) {
        insert_dionysus_movies_one(
          object: {
            id: $id
            adult: $adult
            backdropPath: $backdropPath
            budget: $budget
            homepage: $homepage
            imdbId: $imdbId
            originalLanguageCode: $originalLanguageCode
            originalTitle: $originalTitle
            overview: $overview
            popularity: $popularity
            posterPath: $posterPath
            releaseDate: $releaseDate
            revenue: $revenue
            runtime: $runtime
            status: $status
            tagline: $tagline
            title: $title
            voteAverage: $voteAverage
            voteCount: $voteCount
            video: $video
            alternativeTitles: {
              on_conflict: {
                constraint: movie_alternative_titles_pkey
                update_columns: [title, type, countryCode]
              }
              data: $alternativeTitles
            }
            cast: {
              on_conflict: {
                constraint: movie_cast_pkey
                update_columns: [
                  castId
                  personId
                  originalName
                  order
                  character
                  movieId
                ]
              }
              data: $cast
            }
            crew: {
              on_conflict: {
                constraint: movie_crew_pkey
                update_columns: [
                  personId
                  movieId
                  originalName
                  department
                  job
                ]
              }
              data: $crew
            }
            externalIds: {
              on_conflict: {
                constraint: movie_external_ids_pkey
                update_columns: [externalId]
              }
              data: $externalIds
            }
            genres: {
              on_conflict: {
                constraint: movie_genres_pkey
                update_columns: [genreId]
              }
              data: $genres
            }
            images: {
              on_conflict: {
                constraint: movie_images_pkey
                update_columns: [width, height, languageCode]
              }
              data: $images
            }
            keywords: {
              on_conflict: {
                constraint: movie_keywords_pkey
                update_columns: [keywordId]
              }
              data: $keywords
            }
            productionCompanies: {
              on_conflict: {
                constraint: movie_production_companies_pkey
                update_columns: [productionCompanyId]
              }
              data: $productionCompanies
            }
            productionCountries: {
              on_conflict: {
                constraint: movie_production_countries_pkey
                update_columns: [countryCode]
              }
              data: $productionCountries
            }
            recommendations: {
              on_conflict: {
                constraint: movie_recommendations_pkey
                update_columns: [id, recommendationId]
              }
              data: $recommendations
            }
            releaseDates: {
              on_conflict: {
                constraint: movie_release_dates_pkey
                update_columns: [type, note, languageCode, certificationId]
              }
              data: $releaseDates
            }
            spokenLanguages: {
              on_conflict: {
                constraint: movie_spoken_languages_pkey
                update_columns: [languageCode]
              }
              data: $spokenLanguages
            }
            videos: {
              on_conflict: {
                constraint: movie_videos_pkey
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
            constraint: movies_pkey
            update_columns: [
              adult
              backdropPath
              budget
              homepage
              imdbId
              originalLanguageCode
              originalTitle
              overview
              popularity
              posterPath
              releaseDate
              revenue
              runtime
              status
              tagline
              title
              voteAverage
              voteCount
              video
            ]
          }
        ) {
          adult
          backdropPath
          budget
          createdTime
          homepage
          id
          imdbId
          lastUpdatedTime
          originalLanguageCode
          originalTitle
          overview
          popularity
          posterPath
          releaseDate
          revenue
          runtime
          status
          tagline
          title
          voteCount
          voteAverage
          video
        }
      }
    `;

    const variables = {
      id: request.movie.id,
      adult: request.movie.adult,
      backdropPath: request.movie.backdropPath,
      budget: request.movie.budget,
      homepage: request.movie.homepage,
      imdbId: request.movie.imdbId,
      originalLanguageCode: request.movie.originalLanguageCode,
      originalTitle: request.movie.originalTitle,
      overview: request.movie.overview,
      popularity: request.movie.popularity,
      posterPath: request.movie.posterPath,
      releaseDate: request.movie.releaseDate,
      revenue: request.movie.revenue,
      runtime: request.movie.runtime,
      status: request.movie.status,
      tagline: request.movie.tagline,
      title: request.movie.title,
      voteAverage: request.movie.voteAverage,
      voteCount: request.movie.voteCount,
      video: request.movie.video,
      alternativeTitles: request.movie.alternativeTitles,
      cast: request.movie.cast,
      crew: request.movie.crew,
      externalIds: request.movie.externalIds,
      genres: request.movie.genres,
      images: request.movie.images,
      keywords: request.movie.keywords,
      productionCompanies: request.movie.productionCompanies,
      productionCountries: request.movie.productionCountries,
      recommendations: request.movie.recommendations,
      releaseDates: request.movie.releaseDates,
      spokenLanguages: request.movie.spokenLanguages,
      videos: request.movie.videos,
    };

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMovieResponse>(
        insertRequest,
        variables,
      );

    const responseBody = {
      id: insertResponse.insert_dionysus_movies_one.id,
    };

    setLocation(response, httpRequest, DescribeMovieController, {
      movieId: insertResponse.insert_dionysus_movies_one.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
