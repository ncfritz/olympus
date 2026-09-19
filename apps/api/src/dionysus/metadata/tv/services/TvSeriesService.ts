import {
  BaseTVSeries,
  GetTvSeriesAggregateStatisticsResponse,
  LocationStatistic,
  PartialTVSeries,
  PartialTVSeriesCastMemberRoleWithKey,
  PartialTVSeriesCrewMemberJobWithKey,
  RuntimeStatistic,
  SeasonStatistic,
  SortDirection,
  StatusStatistic,
  TVSeries,
  TVSeriesCastMember,
  TVSeriesCrewMember,
  YearStatistic,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import prettyMilliseconds from "pretty-ms";
import {
  buildFilterExpression,
  buildPaginationExpression,
} from "../../../../utils/filterUtil";
import {
  toBaseDomainObject,
  toDomainObject,
  toTvSeriesCastMember,
  toTvSeriesCrewMember,
} from "../converters/tvSeriesConverter";
import {
  BASE_TV_SERIES,
  TV_SERIES,
  TV_SERIES_CAST_MEMBER,
  TV_SERIES_CREW_MEMBER,
} from "../queries/tvSeries";
import {
  GraphQlBaseTvSeries,
  GraphQlTvSeries,
  GraphQlTvSeriesCastMember,
  GraphQlTvSeriesCrewMember,
  GraphQlTvSeriesRecommendation,
} from "../types/tvSeries";

type GraphQlCreateTVSeriesResponse = {
  insert_dionysus_tv_series_one: {
    id: number;
  };
};

type GraphQlGetTvSeriesResponse = {
  dionysus_tv_series_by_pk: GraphQlTvSeries;
};

type GraphQlListTvSeriesResponse = {
  dionysus_tv_series: GraphQlBaseTvSeries[];
  dionysus_tv_series_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlListTvSeriesCastResponse = {
  dionysus_tv_series_cast: GraphQlTvSeriesCastMember[];
};

type GraphQlListTvSeriesCrewResponse = {
  dionysus_tv_series_crew: GraphQlTvSeriesCrewMember[];
};

type GraphQlListTvSeriesRecommendationsResponse = {
  dionysus_tv_series_by_pk: {
    recommendations: GraphQlTvSeriesRecommendation[];
  };
};

type GraphQlTvSeriesAggregateStatistics = {
  dionysus_tv_series_aggregate: {
    aggregate: {
      count: number;
      sum: {
        numberOfEpisodes: number;
        numberOfSeasons: number;
      };
      max: {
        numberOfEpisodes: number;
        numberOfSeasons: number;
      };
      avg: {
        numberOfEpisodes: number;
        numberOfSeasons: number;
      };
    };
  };
};

type GraphQlGetTvSeriesEpisodeRuntimesResponse = {
  dionysus_tv_series_episode_runtime_statistics: {
    rt: number;
    count: number;
  }[];
};

type GraphQlGetTvSeriesFirstAirYearStatisticsResponse = {
  dionysus_tv_series_first_air_date_statistics: {
    year: number;
    count: number;
  }[];
};

type GraphQlTvSeriesLocationStatistics = {
  dionysus_tv_series_location_statistics: {
    countryCode: string;
    count: number;
  }[];
};

type GraphQlGetTvSeriesSeasonStatisticsResponse = {
  dionysus_tv_series_season_statistics: {
    count: number;
    seasons: number;
  }[];
};

type GraphQlTvSeriesStatusStatistics = {
  dionysus_tv_series_status_statistics: {
    status: string;
    count: number;
  }[];
};

/** Sorting and paging for {@link TvSeriesService.list}. */
export type TvSeriesListOptions = {
  pageSize: number;
  startPage: number;
  sortDirection: SortDirection;
  sortField: string;
  filters?: string;
};

/** One page of TV series and the total number matching the filters. */
export type TvSeriesPage = { tvSeries: BaseTVSeries[]; count: number };

/** Dionysus TV series metadata in Hasura. */
@Injectable()
export class TvSeriesService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * Upserts a TV series with all of its associations; returns its ID. The
   * cast roles and crew jobs are split off `tvSeries.cast` / `tvSeries.crew`
   * (which are modified in place).
   */
  async create(tvSeries: PartialTVSeries): Promise<number> {
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
            recommendations: {
              on_conflict: {
                constraint: tv_series_recommendations_pkey
                update_columns: [id, recommendationId]
              }
              data: $recommendations
            }
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
    const cast = tvSeries.cast.map((castEntry) => {
      castEntry.roles?.forEach((entry) => {
        castRoles.add({
          personId: castEntry.personId,
          seriesId: tvSeries.id,
          creditId: entry.creditId,
          character: entry.character,
          episodeCount: entry.episodeCount,
        });
      });

      delete castEntry.roles;
      return castEntry;
    });

    const crewJobs: Set<PartialTVSeriesCrewMemberJobWithKey> = new Set();
    const crew = tvSeries.crew.map((crewEntry) => {
      crewEntry.jobs?.forEach((entry) => {
        crewJobs.add({
          personId: crewEntry.personId,
          seriesId: tvSeries.id,
          creditId: entry.creditId,
          job: entry.job,
          episodeCount: entry.episodeCount,
        });
      });

      delete crewEntry.jobs;
      return crewEntry;
    });
    const variables = {
      id: tvSeries.id,
      adult: tvSeries.adult,
      backdropPath: tvSeries.backdropPath,
      firstAirDate: tvSeries.firstAirDate,
      homepage: tvSeries.homepage,
      inProduction: tvSeries.inProduction,
      lastAirDate: tvSeries.lastAirDate,
      lastEpisodeToAirId: tvSeries.lastEpisodeToAirId,
      name: tvSeries.name,
      numberOfEpisodes: tvSeries.numberOfEpisodes || 0,
      numberOfSeasons: tvSeries.numberOfSeasons || 0,
      originalName: tvSeries.originalName,
      original_language: tvSeries.originalLanguageCode,
      overview: tvSeries.overview,
      popularity: tvSeries.popularity,
      posterPath: tvSeries.posterPath,
      status: tvSeries.status,
      tagline: tvSeries.tagline,
      type: tvSeries.type,
      voteAverage: tvSeries.voteAverage,
      voteCount: tvSeries.voteCount,
      alternativeTitles: tvSeries.alternativeTitles,
      cast: cast,
      certifications: tvSeries.certifications,
      createdBy: tvSeries.createdBy,
      crew: crew,
      episodeRunTimes: tvSeries.runtimes,
      externalIds: tvSeries.externalIds,
      genres: tvSeries.genres,
      images: tvSeries.images,
      keywords: tvSeries.keywords,
      languages: tvSeries.languages,
      networks: tvSeries.networks,
      originCountries: tvSeries.originCountries,
      productionCompanies: tvSeries.productionCompanies,
      productionCountries: tvSeries.productionCountries,
      recommendations: tvSeries.recommendations,
      spokenLanguages: tvSeries.spokenLanguages,
      videos: tvSeries.videos,
      castRoles: [...castRoles],
      crewJobs: [...crewJobs],
    };

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateTVSeriesResponse>(
        insertRequest,
        variables,
      );

    return insertResponse.insert_dionysus_tv_series_one.id;
  }

  /** @throws NotFoundException */
  async describe(tvSeriesId: number): Promise<TVSeries> {
    const fetchRequest = gql`
      query DescribeTvSeries($id: numeric!) {
        dionysus_tv_series_by_pk(id: $id) {
          ${TV_SERIES}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesResponse>(
        fetchRequest,
        {
          id: tvSeriesId,
        },
      );

    if (!fetchResponse.dionysus_tv_series_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(fetchResponse.dionysus_tv_series_by_pk);
  }

  /** A page of TV series matching the (base64-encoded) filters. */
  async list(options: TvSeriesListOptions): Promise<TvSeriesPage> {
    const whereExpression = buildFilterExpression(options.filters);
    const paginationExpression = buildPaginationExpression({
      pageSize: options.pageSize,
      startPage: options.startPage,
      sortDirection: options.sortDirection,
      sortField: options.sortField,
    });
    const fetchRequest = gql`
      query ListTvSeries {
        dionysus_tv_series(${[paginationExpression, whereExpression].join(", ")}) {
          ${BASE_TV_SERIES}
        }
        dionysus_tv_series_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeriesResponse>(
        fetchRequest,
      );

    return {
      tvSeries: fetchResponse.dionysus_tv_series.map((result) =>
        toBaseDomainObject(result),
      ),
      count: fetchResponse.dionysus_tv_series_aggregate.aggregate.count,
    };
  }

  /** The cast of a TV series in billing order, skipping unknown people. */
  async listCast(tvSeriesId: number): Promise<TVSeriesCastMember[]> {
    const fetchRequest = gql`
      query ListTvSeriesCast($id: numeric!) {
        dionysus_tv_series_cast(
          order_by: { order: asc }
          where: { seriesId: { _eq: $id } }
        ) {
          ${TV_SERIES_CAST_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeriesCastResponse>(
        fetchRequest,
        { id: tvSeriesId },
      );
    const cast: TVSeriesCastMember[] = [];

    fetchResponse.dionysus_tv_series_cast.forEach((result) => {
      if (result.person) {
        cast.push(toTvSeriesCastMember(result));
      }
    });

    return cast;
  }

  /** The crew of a TV series, skipping unknown people. */
  async listCrew(tvSeriesId: number): Promise<TVSeriesCrewMember[]> {
    const fetchRequest = gql`
      query ListTvSeriesCrew($id: numeric!) {
        dionysus_tv_series_crew(where: { seriesId: { _eq: $id } }) {
          ${TV_SERIES_CREW_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeriesCrewResponse>(
        fetchRequest,
        { id: tvSeriesId },
      );
    const crew: TVSeriesCrewMember[] = [];

    fetchResponse.dionysus_tv_series_crew.forEach((result) => {
      if (result.person) {
        crew.push(toTvSeriesCrewMember(result));
      }
    });

    return crew;
  }

  /** Recommended TV series that are in the database. @throws NotFoundException */
  async listRecommendations(tvSeriesId: number): Promise<BaseTVSeries[]> {
    const fetchRequest = gql`
      query ListTvSeriesRecommendations($id: numeric!) {
        dionysus_tv_series_by_pk(id: $id) {
          recommendations {
            tvSeries {
              ${BASE_TV_SERIES}
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeriesRecommendationsResponse>(
        fetchRequest,
        { id: tvSeriesId },
      );
    if (!fetchResponse.dionysus_tv_series_by_pk) {
      throw new NotFoundException();
    }

    const recommendations: BaseTVSeries[] = [];

    fetchResponse.dionysus_tv_series_by_pk.recommendations.forEach((result) => {
      // Skip links to rows that are not in the database (yet).
      if (result.tvSeries) {
        recommendations.push(toBaseDomainObject(result.tvSeries));
      }
    });

    return recommendations;
  }

  async getAggregateStatistics(): Promise<GetTvSeriesAggregateStatisticsResponse> {
    const fetchRequest = gql`
      query GetTvSeriesAggregateStatistics {
        dionysus_tv_series_aggregate {
          aggregate {
            count
            sum {
              numberOfEpisodes
              numberOfSeasons
            }
            max {
              numberOfEpisodes
              numberOfSeasons
            }
            avg {
              numberOfEpisodes
              numberOfSeasons
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlTvSeriesAggregateStatistics>(
        fetchRequest,
      );

    return {
      count: fetchResponse.dionysus_tv_series_aggregate.aggregate.count,
      totalSeasons:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.sum
          .numberOfSeasons,
      totalEpisodes:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.sum
          .numberOfEpisodes,
      maxSeasonCount:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.max
          .numberOfSeasons,
      maxEpisodeCount:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.max
          .numberOfEpisodes,
      averageSeasonCount:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.avg
          .numberOfSeasons,
      averageEpisodeCount:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.avg
          .numberOfEpisodes,
    };
  }

  /** Histogram of TV episode runtimes (minutes). */
  async getEpisodeRuntimeStatistics(): Promise<RuntimeStatistic[]> {
    const fetchRequest = gql`
      query GetTvSeriesEpisodeRuntimeStatistics {
        dionysus_tv_series_episode_runtime_statistics {
          rt
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesEpisodeRuntimesResponse>(
        fetchRequest,
      );
    const runtimeStatistics: RuntimeStatistic[] = [];

    fetchResponse.dionysus_tv_series_episode_runtime_statistics.forEach(
      (result) => {
        runtimeStatistics.push({
          runtime: result.rt,
          label: prettyMilliseconds(result.rt * 60 * 1000, { unitCount: 2 }),
          count: result.count,
        });
      },
    );

    return runtimeStatistics;
  }

  /** TV series counts per first-air year, oldest first. */
  async getFirstAirYearStatistics(): Promise<YearStatistic[]> {
    const fetchRequest = gql`
      query GetTvSeriesFirstAirYearStatistics {
        dionysus_tv_series_first_air_date_statistics(order_by: { year: asc }) {
          count
          year
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesFirstAirYearStatisticsResponse>(
        fetchRequest,
      );
    const releaseYearStatistics: YearStatistic[] = [];

    fetchResponse.dionysus_tv_series_first_air_date_statistics.forEach(
      (result) => {
        releaseYearStatistics.push(result);
      },
    );

    return releaseYearStatistics;
  }

  /** TV series counts per production country. */
  async getLocationStatistics(): Promise<LocationStatistic[]> {
    const fetchRequest = gql`
      query GetTvSeriesLocationStatistics {
        dionysus_tv_series_location_statistics {
          countryCode
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlTvSeriesLocationStatistics>(
        fetchRequest,
      );
    const statistics: LocationStatistic[] = [];

    fetchResponse.dionysus_tv_series_location_statistics.forEach((result) => {
      statistics.push({
        countryCode: result.countryCode,
        count: result.count,
      });
    });

    return statistics;
  }

  /** TV series counts per number of seasons. */
  async getSeasonStatistics(): Promise<SeasonStatistic[]> {
    const fetchRequest = gql`
      query GetTvSeriesSeasonStatistics {
        dionysus_tv_series_season_statistics {
          count
          seasons
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesSeasonStatisticsResponse>(
        fetchRequest,
      );
    const seasonStatistics: SeasonStatistic[] = [];

    fetchResponse.dionysus_tv_series_season_statistics.forEach((result) => {
      seasonStatistics.push(result);
    });

    return seasonStatistics;
  }

  /** TV series counts per status. */
  async getStatusStatistics(): Promise<StatusStatistic[]> {
    const fetchRequest = gql`
      query GetTvSeriesStatusStatistics {
        dionysus_tv_series_status_statistics {
          status
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlTvSeriesStatusStatistics>(
        fetchRequest,
      );
    const statistics: StatusStatistic[] = [];

    fetchResponse.dionysus_tv_series_status_statistics.forEach((result) => {
      statistics.push({
        status: result.status,
        count: result.count,
      });
    });

    return statistics;
  }
}
