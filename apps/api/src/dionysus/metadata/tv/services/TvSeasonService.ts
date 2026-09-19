import {
  PartialSeason,
  PartialTVSeasonCastMemberRoleWithKey,
  PartialTVSeasonCrewMemberJobWithKey,
  Season,
  TVSeriesCastMember,
  TVSeriesCrewMember,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/tvSeasonConverter";
import {
  toTvSeriesCastMember,
  toTvSeriesCrewMember,
} from "../converters/tvSeriesConverter";
import {
  TV_SEASON,
  TV_SERIES_CAST_MEMBER,
  TV_SERIES_CREW_MEMBER,
} from "../queries/tvSeries";
import { GraphQlTvSeason } from "../types/tvSeason";
import {
  GraphQlTvSeriesCastMember,
  GraphQlTvSeriesCrewMember,
} from "../types/tvSeries";

type GraphQlCreateTVSeasonResponse = {
  insert_dionysus_tv_seasons_one: {
    id: number;
    seasonNumber: number;
    seriesId: number;
  };
};

type GraphQlGetTvSeasonResponse = {
  dionysus_tv_seasons: GraphQlTvSeason[];
};

type GraphQlTvSeasonIdLookupResponse = {
  dionysus_tv_seasons: {
    id: number;
  }[];
};

type GraphQlListTvSeasonCastResponse = {
  dionysus_tv_season_cast: GraphQlTvSeriesCastMember[];
};

type GraphQlListTvSeasonCrewResponse = {
  dionysus_tv_season_crew: GraphQlTvSeriesCrewMember[];
};

/** The keys of an upserted TV season. */
export type CreatedTvSeason = {
  id: number;
  seasonNumber: number;
  seriesId: number;
};

/** Dionysus TV season metadata in Hasura. */
@Injectable()
export class TvSeasonService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * Upserts a season of TV series `seriesId` with all of its associations.
   * The cast roles and crew jobs are split off `season.cast` / `season.crew`
   * (which are modified in place).
   */
  async create(
    seriesId: number,
    season: PartialSeason,
  ): Promise<CreatedTvSeason> {
    const insertRequest = gql`
      mutation CreateTVSeriesSeason(
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
    const cast = season.cast.map((castEntry) => {
      castEntry.roles?.forEach((entry) => {
        castRoles.add({
          personId: castEntry.personId,
          seriesId: seriesId,
          seasonId: season.id,
          creditId: entry.creditId,
          character: entry.character,
          episodeCount: entry.episodeCount,
        });
      });

      delete castEntry.roles;
      return castEntry;
    });

    const crewJobs: Set<PartialTVSeasonCrewMemberJobWithKey> = new Set();
    const crew = season.crew.map((crewEntry) => {
      crewEntry.jobs?.forEach((entry) => {
        crewJobs.add({
          personId: crewEntry.personId,
          seriesId: seriesId,
          seasonId: season.id,
          creditId: entry.creditId,
          job: entry.job,
          episodeCount: entry.episodeCount,
        });
      });

      delete crewEntry.jobs;
      return crewEntry;
    });
    const variables = {
      id: season.id,
      seriesId: seriesId,
      seasonNumber: season.seasonNumber,
      airDate: season.airDate,
      name: season.name,
      overview: season.overview,
      posterPath: season.posterPath,
      voteAverage: season.voteAverage,
      cast: cast,
      crew: crew,
      externalIds: season.externalIds,
      images: season.images,
      videos: season.videos,
      castRoles: [...castRoles],
      crewJobs: [...crewJobs],
    };

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateTVSeasonResponse>(
        insertRequest,
        variables,
      );

    return {
      id: insertResponse.insert_dionysus_tv_seasons_one.id,
      seasonNumber: insertResponse.insert_dionysus_tv_seasons_one.seasonNumber,
      seriesId: insertResponse.insert_dionysus_tv_seasons_one.seriesId,
    };
  }

  /** @throws NotFoundException */
  async describe(tvSeriesId: number, seasonNumber: number): Promise<Season> {
    const fetchRequest = gql`
      query DescribeTvSeason($seriesId: numeric!, $seasonNumber: numeric!) {
        dionysus_tv_seasons(
          where: {
            _and: {
              seriesId: { _eq: $seriesId }
              seasonNumber: { _eq: $seasonNumber }
            }
          }
        ) {
          ${TV_SEASON}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeasonResponse>(
        fetchRequest,
        {
          seriesId: tvSeriesId,
          seasonNumber: seasonNumber,
        },
      );

    if (
      !fetchResponse.dionysus_tv_seasons ||
      fetchResponse.dionysus_tv_seasons.length <= 0
    ) {
      throw new NotFoundException();
    }

    return toDomainObject(fetchResponse.dionysus_tv_seasons[0]);
  }

  /** The cast of a season, skipping unknown people. @throws NotFoundException */
  async listCast(
    tvSeriesId: number,
    seasonNumber: number,
  ): Promise<TVSeriesCastMember[]> {
    const seasonId = await this.lookupSeasonId(tvSeriesId, seasonNumber);
    const fetchRequest = gql`
      query ListTvSeasonCast($id: numeric!) {
        dionysus_tv_season_cast(where: { seasonId: { _eq: $id } }) {
          ${TV_SERIES_CAST_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeasonCastResponse>(
        fetchRequest,
        { id: seasonId },
      );
    const cast: TVSeriesCastMember[] = [];

    fetchResponse.dionysus_tv_season_cast.forEach((result) => {
      if (result.person) {
        cast.push(toTvSeriesCastMember(result));
      }
    });

    return cast;
  }

  /** The crew of a season, skipping unknown people. @throws NotFoundException */
  async listCrew(
    tvSeriesId: number,
    seasonNumber: number,
  ): Promise<TVSeriesCrewMember[]> {
    const seasonId = await this.lookupSeasonId(tvSeriesId, seasonNumber);
    const fetchRequest = gql`
      query ListTvSeasonCrew($id: numeric!) {
        dionysus_tv_season_crew(where: { seasonId: { _eq: $id } }) {
         ${TV_SERIES_CREW_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeasonCrewResponse>(
        fetchRequest,
        { id: seasonId },
      );
    const crew: TVSeriesCrewMember[] = [];

    fetchResponse.dionysus_tv_season_crew.forEach((result) => {
      if (result.person) {
        crew.push(toTvSeriesCrewMember(result));
      }
    });

    return crew;
  }

  /** The ID of a season by series and season number. @throws NotFoundException */
  private async lookupSeasonId(
    tvSeriesId: number,
    seasonNumber: number,
  ): Promise<number> {
    const seasonIdLookupRequest = gql`
      query LookupTvSeasonId($seriesId: numeric!, $seasonNumber: numeric!) {
        dionysus_tv_seasons(
          where: {
            _and: {
              seriesId: { _eq: $seriesId }
              seasonNumber: { _eq: $seasonNumber }
            }
          }
        ) {
          id
        }
      }
    `;

    const tvSeriesIdFetchResponse =
      await this.graphQLClient.request<GraphQlTvSeasonIdLookupResponse>(
        seasonIdLookupRequest,
        {
          seriesId: tvSeriesId,
          seasonNumber: seasonNumber,
        },
      );

    if (tvSeriesIdFetchResponse.dionysus_tv_seasons.length <= 0) {
      throw new NotFoundException();
    }

    return tvSeriesIdFetchResponse.dionysus_tv_seasons[0].id;
  }
}
