import {
  Collection,
  GetMovieAggregateStatisticsResponse,
  LocationStatistic,
  Movie,
  MovieCastMember,
  MovieCrewMember,
  PartialMovie,
  RuntimeStatistic,
  SortDirection,
  SparseMovie,
  StatusStatistic,
  YearStatistic,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { BASE_COLLECTION } from "../../collections/queries/collections";
import {
  LOCATION_STATISTIC,
  RUNTIME_STATISTIC,
  STATUS_STATISTIC,
  YEAR_STATISTIC,
} from "../../queries/common";
import prettyMilliseconds from "pretty-ms";
import { toDomainObject as toCollectionDomainObject } from "../../collections/converters/CollectionConverter";
import { toMovieCastDomainObject } from "../../converters/CastConverter";
import { toMovieCrewDomainObject } from "../../converters/CrewConverter";
import {
  GraphQlCollection,
  GraphQlMovieCastMember,
  GraphQlMovieCrewMember,
  Timestamped,
} from "../../types/metadata";
import { MEDIA_ASSET } from "../../../media/assets/queries/mediaAsset";
import { SEARCH_CONFIGURATION } from "../../../media/searchConfigurations/queries/searchConfiguration";
import {
  buildFilterExpression,
  buildPaginationExpression,
} from "../../../../utils/filterUtil";
import {
  toDomainObject,
  toSparseDomainObject,
} from "../converters/MovieConverter";
import {
  BASE_MOVIE_RECOMMENDATION,
  MOVIE,
  MOVIE_CAST_MEMBER,
  MOVIE_COLUMNS,
  MOVIE_SUMMARY_WITH_ORIGINAL_LANGUAGE,
  MOVIE_CREW_MEMBER,
  SPARSE_MOVIE,
} from "../queries/movies";
import {
  GraphQlMovie,
  GraphQlMovieRecommendation,
  GraphQlSparseMovie,
} from "../types/movie";

type GraphQlCreateMovieResponse = {
  insert_dionysus_movies_one: GraphQlSparseMovie;
};

type GraphQlGetMovieResponse = {
  dionysus_movies_by_pk: GraphQlMovie;
};

type GraphQlListMoviesResponse = {
  dionysus_movies: GraphQlSparseMovie[];
  dionysus_movies_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlListMovieCastResponse = {
  dionysus_movie_cast: GraphQlMovieCastMember[];
};

type GraphQlListMovieCrewResponse = {
  dionysus_movie_crew: GraphQlMovieCrewMember[];
};

type GraphQlListMovieCollectionsResponse = {
  dionysus_movies_by_pk: {
    collections: Timestamped &
      {
        collection: GraphQlCollection;
      }[];
  };
};

type GraphQlListMovieRecommendationsResponse = {
  dionysus_movies_by_pk: {
    recommendations: GraphQlMovieRecommendation[];
  };
};

type GraphQlMovieAggregateStatistics = {
  dionysus_movies_aggregate: {
    aggregate: {
      count: number;
      avg: {
        budget: number;
        revenue: number;
        runtime: number;
      };
      max: {
        revenue: number;
      };
    };
  };
};

type GraphQlMovieLocationStatistics = {
  dionysus_movie_location_statistics: {
    countryCode: string;
    count: number;
  }[];
};

type GraphQlMovieReleaseStatusStatistics = {
  dionysus_movie_release_status_statistics: {
    status: string;
    count: number;
  }[];
};

type GraphQlGetMovieReleaseYearStatisticsResponse = {
  dionysus_movie_release_date_statistics: {
    year: number;
    count: number;
  }[];
};

type GraphQGetMovieRuntimeStatisticsResponse = {
  dionysus_movie_runtime_statistics: {
    rt: number;
    count: number;
  }[];
};

/** Sorting and paging for {@link MovieService.list}. */
export type MovieListOptions = {
  pageSize: number;
  startPage: number;
  sortDirection: SortDirection;
  sortField: string;
  filters?: string;
};

/** One page of movies and the total number matching the filters. */
export type MoviePage = { movies: SparseMovie[]; count: number };

/** Dionysus movie metadata in Hasura. */
@Injectable()
export class MovieService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Upserts a movie with all of its associations; returns its ID. */
  async create(movie: PartialMovie): Promise<number> {
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
          ${MOVIE_COLUMNS}
          }
      }
    `;
    const variables = {
      id: movie.id,
      adult: movie.adult,
      backdropPath: movie.backdropPath,
      budget: movie.budget,
      homepage: movie.homepage,
      imdbId: movie.imdbId,
      originalLanguageCode: movie.originalLanguageCode,
      originalTitle: movie.originalTitle,
      overview: movie.overview,
      popularity: movie.popularity,
      posterPath: movie.posterPath,
      releaseDate: movie.releaseDate,
      revenue: movie.revenue,
      runtime: movie.runtime,
      status: movie.status,
      tagline: movie.tagline,
      title: movie.title,
      voteAverage: movie.voteAverage,
      voteCount: movie.voteCount,
      video: movie.video,
      alternativeTitles: movie.alternativeTitles,
      cast: movie.cast,
      crew: movie.crew,
      externalIds: movie.externalIds,
      genres: movie.genres,
      images: movie.images,
      keywords: movie.keywords,
      productionCompanies: movie.productionCompanies,
      productionCountries: movie.productionCountries,
      recommendations: movie.recommendations,
      releaseDates: movie.releaseDates,
      spokenLanguages: movie.spokenLanguages,
      videos: movie.videos,
    };

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMovieResponse>(
        insertRequest,
        variables,
      );

    return insertResponse.insert_dionysus_movies_one.id;
  }

  /** @throws NotFoundException */
  async describe(movieId: number): Promise<Movie> {
    const fetchRequest = gql`
      query DescribeMovie($id: numeric!) {
        dionysus_movies_by_pk(id: $id) {
          ${MOVIE}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMovieResponse>(fetchRequest, {
        id: movieId,
      });

    if (!fetchResponse.dionysus_movies_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(fetchResponse.dionysus_movies_by_pk);
  }

  /** A page of movies matching the (base64-encoded) filters. */
  async list(options: MovieListOptions): Promise<MoviePage> {
    const whereExpression = buildFilterExpression(options.filters);
    const paginationExpression = buildPaginationExpression({
      pageSize: options.pageSize,
      startPage: options.startPage,
      sortDirection: options.sortDirection,
      sortField: options.sortField,
    });
    const fetchRequest = gql`
      query ListMovies {
        dionysus_movies(${[paginationExpression, whereExpression].join(", ")}) {
          ${SPARSE_MOVIE}
        }
        dionysus_movies_aggregate${
          whereExpression ? `(${whereExpression})` : ""
        } {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMoviesResponse>(fetchRequest);

    return {
      movies: fetchResponse.dionysus_movies.map((result) =>
        toSparseDomainObject(result),
      ),
      count: fetchResponse.dionysus_movies_aggregate.aggregate.count,
    };
  }

  /** The cast of a movie in billing order, skipping unknown people. */
  async listCast(movieId: number): Promise<MovieCastMember[]> {
    const fetchRequest = gql`
      query ListMovieCast($id: numeric!) {
        dionysus_movie_cast(
          order_by: { order: asc }
          where: { movieId: { _eq: $id } }
        ) {
          ${MOVIE_CAST_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMovieCastResponse>(
        fetchRequest,
        { id: movieId },
      );
    const cast: MovieCastMember[] = [];

    fetchResponse.dionysus_movie_cast.forEach((result) => {
      if (result.person) {
        cast.push(toMovieCastDomainObject(result));
      }
    });

    return cast;
  }

  /** The crew of a movie, skipping unknown people. */
  async listCrew(movieId: number): Promise<MovieCrewMember[]> {
    const fetchRequest = gql`
      query ListMovieCrew($id: numeric!) {
        dionysus_movie_crew(where: { movieId: { _eq: $id } }) {
          ${MOVIE_CREW_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMovieCrewResponse>(
        fetchRequest,
        { id: movieId },
      );
    const crew: MovieCrewMember[] = [];

    fetchResponse.dionysus_movie_crew.forEach((result) => {
      if (result.person) {
        crew.push(toMovieCrewDomainObject(result));
      }
    });

    return crew;
  }

  /** The collections a movie belongs to. @throws NotFoundException */
  async listCollections(movieId: number): Promise<Collection[]> {
    const fetchRequest = gql`
      query ListMovieCollections($id: numeric!) {
        dionysus_movies_by_pk(id: $id) {
          collections {
            createdTime
            lastUpdatedTime
            collection {
              ${BASE_COLLECTION}
              parts {
                createdTime
                lastUpdatedTime
                movie {
                  ${MOVIE_SUMMARY_WITH_ORIGINAL_LANGUAGE}
                  ${SEARCH_CONFIGURATION}
                  ${MEDIA_ASSET}
                }
              }
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMovieCollectionsResponse>(
        fetchRequest,
        { id: movieId },
      );
    if (!fetchResponse.dionysus_movies_by_pk) {
      throw new NotFoundException();
    }

    const collections: Collection[] = [];

    fetchResponse.dionysus_movies_by_pk.collections.forEach((result) => {
      collections.push(toCollectionDomainObject(result.collection));
    });

    return collections;
  }

  /** Recommended movies that are in the database. @throws NotFoundException */
  async listRecommendations(movieId: number): Promise<SparseMovie[]> {
    const fetchRequest = gql`
      query ListMovieRecommendations($id: numeric!) {
        dionysus_movies_by_pk(id: $id) {
          recommendations {
            ${BASE_MOVIE_RECOMMENDATION}
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMovieRecommendationsResponse>(
        fetchRequest,
        { id: movieId },
      );
    if (!fetchResponse.dionysus_movies_by_pk) {
      throw new NotFoundException();
    }

    const recommendations: SparseMovie[] = [];

    fetchResponse.dionysus_movies_by_pk.recommendations.forEach((result) => {
      // Skip links to rows that are not in the database (yet).
      if (result.movie) {
        recommendations.push(toSparseDomainObject(result.movie));
      }
    });

    return recommendations;
  }

  async getAggregateStatistics(): Promise<GetMovieAggregateStatisticsResponse> {
    const fetchRequest = gql`
      query GetMovieAggregateStatistics {
        dionysus_movies_aggregate {
          aggregate {
            count
            avg {
              budget
              revenue
              runtime
            }
            max {
              revenue
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlMovieAggregateStatistics>(
        fetchRequest,
      );

    return {
      averageBudget:
        fetchResponse.dionysus_movies_aggregate.aggregate.avg.budget,
      averageRevenue:
        fetchResponse.dionysus_movies_aggregate.aggregate.avg.revenue,
      averageRuntime:
        fetchResponse.dionysus_movies_aggregate.aggregate.avg.runtime,
      count: fetchResponse.dionysus_movies_aggregate.aggregate.count,
      maxRevenue: fetchResponse.dionysus_movies_aggregate.aggregate.max.revenue,
    };
  }

  /** Movie counts per production country. */
  async getLocationStatistics(): Promise<LocationStatistic[]> {
    const fetchRequest = gql`
      query GetMovieLocationStatistics {
        dionysus_movie_location_statistics {
          ${LOCATION_STATISTIC}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlMovieLocationStatistics>(
        fetchRequest,
      );
    const statistics: LocationStatistic[] = [];

    fetchResponse.dionysus_movie_location_statistics.forEach((result) => {
      statistics.push({
        countryCode: result.countryCode,
        count: result.count,
      });
    });

    return statistics;
  }

  /** Movie counts per release status. */
  async getReleaseStatusStatistics(): Promise<StatusStatistic[]> {
    const fetchRequest = gql`
      query GetMovieReleaseStatusStatistics {
        dionysus_movie_release_status_statistics {
          ${STATUS_STATISTIC}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlMovieReleaseStatusStatistics>(
        fetchRequest,
      );
    const statistics: StatusStatistic[] = [];

    fetchResponse.dionysus_movie_release_status_statistics.forEach((result) => {
      statistics.push({
        status: result.status,
        count: result.count,
      });
    });

    return statistics;
  }

  /** Movie counts per release year, oldest first. */
  async getReleaseYearStatistics(): Promise<YearStatistic[]> {
    const fetchRequest = gql`
      query GetMovieReleaseYearStatistics {
        dionysus_movie_release_date_statistics(order_by: { year: asc }) {
          ${YEAR_STATISTIC}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMovieReleaseYearStatisticsResponse>(
        fetchRequest,
      );
    const releaseYearStatistics: YearStatistic[] = [];

    fetchResponse.dionysus_movie_release_date_statistics.forEach((result) => {
      releaseYearStatistics.push(result);
    });

    return releaseYearStatistics;
  }

  /** Histogram of movie runtimes (minutes). */
  async getRuntimeStatistics(): Promise<RuntimeStatistic[]> {
    const fetchRequest = gql`
      query GetMovieRuntimeStatistics {
        dionysus_movie_runtime_statistics {
          ${RUNTIME_STATISTIC}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQGetMovieRuntimeStatisticsResponse>(
        fetchRequest,
      );
    const runtimeStatistics: RuntimeStatistic[] = [];

    fetchResponse.dionysus_movie_runtime_statistics.forEach((result) => {
      runtimeStatistics.push({
        runtime: result.rt,
        label: prettyMilliseconds(result.rt * 60 * 1000, { unitCount: 2 }),
        count: result.count,
      });
    });

    return runtimeStatistics;
  }
}
