import {
  Episode,
  PartialEpisode,
  TVEpisodeCastMember,
  TVEpisodeCrewMember,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  toDomainObject,
  toTvEpisodeCastMember,
  toTvEpisodeCrewMember,
} from "../converters/tvEpisodeConverter";
import {
  BASE_TV_EPISODE_CREW_MEMBER,
  TV_EPISODE,
  TV_EPISODE_CAST_MEMBER,
} from "../queries/tvSeries";
import {
  GraphQlTvEpisode,
  GraphQlTvEpisodeCastMember,
  GraphQlTvEpisodeCrewMember,
} from "../types/tvEpisode";

type GraphQlCreateTVEpisodeResponse = {
  insert_dionysus_tv_episodes_one: {
    id: number;
    episodeNumber: number;
    seasonId: number;
    seasonNumber: number;
    seriesId: number;
  };
};

type GraphQlGetTvEpisodeResponse = {
  dionysus_tv_episodes: GraphQlTvEpisode[];
};

type GraphQlGetTvEpisodeByIdResponse = {
  dionysus_tv_episodes_by_pk: GraphQlTvEpisode;
};

type GraphQlTvEpisodeIdLookupResponse = {
  dionysus_tv_episodes: {
    id: number;
  }[];
};

type GraphQlListTvEpisodeCastResponse = {
  dionysus_tv_episode_cast: GraphQlTvEpisodeCastMember[];
};

type GraphQlListTvEpisodeCrewResponse = {
  dionysus_tv_episode_crew: GraphQlTvEpisodeCrewMember[];
};

type GraphQlListTvEpisodeGuestStarsResponse = {
  dionysus_tv_episode_guest_stars: GraphQlTvEpisodeCastMember[];
};

/** The keys of an upserted TV episode. */
export type CreatedTvEpisode = {
  id: number;
  episodeNumber: number;
  seasonId: number;
  seasonNumber: number;
  seriesId: number;
};

/** Dionysus TV episode metadata in Hasura. */
@Injectable()
export class TvEpisodeService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Upserts an episode of season `seasonNumber` of TV series `seriesId`. */
  async create(
    seriesId: number,
    seasonNumber: number,
    episode: PartialEpisode,
  ): Promise<CreatedTvEpisode> {
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
      id: episode.id,
      seriesId: seriesId,
      seasonId: episode.seasonId,
      airDate: episode.airDate,
      episodeNumber: episode.episodeNumber,
      name: episode.name,
      overview: episode.overview,
      productionCode: episode.productionCode,
      stillPath: episode.stillPath,
      seasonNumber: seasonNumber,
      cast: episode.cast,
      crew: episode.crew,
      images: episode.images,
      guestStars: episode.guestStars,
      videos: episode.videos,
      externalIds: episode.externalIds,
      voteCount: episode.voteCount,
      voteAverage: episode.voteAverage,
    };

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateTVEpisodeResponse>(
        insertRequest,
        variables,
      );

    return {
      id: insertResponse.insert_dionysus_tv_episodes_one.id,
      episodeNumber:
        insertResponse.insert_dionysus_tv_episodes_one.episodeNumber,
      seasonId: insertResponse.insert_dionysus_tv_episodes_one.seasonId,
      seasonNumber: insertResponse.insert_dionysus_tv_episodes_one.seasonNumber,
      seriesId: insertResponse.insert_dionysus_tv_episodes_one.seriesId,
    };
  }

  /** An episode by series, season and episode number. @throws NotFoundException */
  async describe(
    tvSeriesId: number,
    seasonNumber: number,
    episodeNumber: number,
  ): Promise<Episode> {
    const fetchRequest = gql`
      query DescribeTvEpisode(
        $seriesId: numeric!
        $seasonNumber: numeric!
        $episodeNumber: numeric!
      ) {
        dionysus_tv_episodes(
          where: {
            _and: {
              seriesId: { _eq: $seriesId }
              seasonNumber: { _eq: $seasonNumber }
              episodeNumber: { _eq: $episodeNumber }
            }
          }
        ) {
          ${TV_EPISODE}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvEpisodeResponse>(
        fetchRequest,
        {
          seriesId: tvSeriesId,
          seasonNumber: seasonNumber,
          episodeNumber: episodeNumber,
        },
      );

    if (
      !fetchResponse.dionysus_tv_episodes ||
      fetchResponse.dionysus_tv_episodes.length <= 0
    ) {
      throw new NotFoundException();
    }

    return toDomainObject(fetchResponse.dionysus_tv_episodes[0]);
  }

  /** An episode by its (TMDB) ID. @throws NotFoundException */
  async describeById(episodeId: number): Promise<Episode> {
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
      await this.graphQLClient.request<GraphQlGetTvEpisodeByIdResponse>(
        fetchRequest,
        {
          episodeId: episodeId,
        },
      );

    if (!fetchResponse.dionysus_tv_episodes_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(fetchResponse.dionysus_tv_episodes_by_pk);
  }

  /** The cast of an episode, skipping unknown people. @throws NotFoundException */
  async listCast(
    tvSeriesId: number,
    seasonNumber: number,
    episodeNumber: number,
  ): Promise<TVEpisodeCastMember[]> {
    const episodeId = await this.lookupEpisodeId(
      tvSeriesId,
      seasonNumber,
      episodeNumber,
    );
    const fetchRequest = gql`
      query ListTvEpisodeCast($episodeId: numeric!) {
        dionysus_tv_episode_cast(where: { episodeId: { _eq: $episodeId } }) {
          ${TV_EPISODE_CAST_MEMBER}
        }
      }`;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvEpisodeCastResponse>(
        fetchRequest,
        { episodeId: episodeId },
      );
    const cast: TVEpisodeCastMember[] = [];

    fetchResponse.dionysus_tv_episode_cast.forEach((result) => {
      if (result.person) {
        cast.push(toTvEpisodeCastMember(result));
      }
    });

    return cast;
  }

  /** The crew of an episode, skipping unknown people. @throws NotFoundException */
  async listCrew(
    tvSeriesId: number,
    seasonNumber: number,
    episodeNumber: number,
  ): Promise<TVEpisodeCrewMember[]> {
    const episodeId = await this.lookupEpisodeId(
      tvSeriesId,
      seasonNumber,
      episodeNumber,
    );
    const fetchRequest = gql`
      query ListTvEpisodeCrew($episodeId: numeric!) {
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

    return crew;
  }

  /** The guest stars of an episode, skipping unknown people. @throws NotFoundException */
  async listGuestStars(
    tvSeriesId: number,
    seasonNumber: number,
    episodeNumber: number,
  ): Promise<TVEpisodeCastMember[]> {
    const episodeId = await this.lookupEpisodeId(
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
      await this.graphQLClient.request<GraphQlListTvEpisodeGuestStarsResponse>(
        fetchRequest,
        { episodeId: episodeId },
      );
    const guestStars: TVEpisodeCastMember[] = [];

    fetchResponse.dionysus_tv_episode_guest_stars.forEach((result) => {
      if (result.person) {
        guestStars.push(toTvEpisodeCastMember(result));
      }
    });

    return guestStars;
  }

  /**
   * The ID of an episode by series, season and episode number.
   * @throws NotFoundException
   */
  private async lookupEpisodeId(
    tvSeriesId: number,
    seasonNumber: number,
    episodeNumber: number,
  ): Promise<number> {
    const seasonIdLookupRequest = gql`
      query LookupTvEpisodeId(
        $seriesId: numeric!
        $seasonNumber: numeric!
        $episodeNumber: numeric!
      ) {
        dionysus_tv_episodes(
          where: {
            _and: {
              seriesId: { _eq: $seriesId }
              seasonNumber: { _eq: $seasonNumber }
              episodeNumber: { _eq: $episodeNumber }
            }
          }
        ) {
          id
        }
      }
    `;

    const tvSeriesIdFetchResponse =
      await this.graphQLClient.request<GraphQlTvEpisodeIdLookupResponse>(
        seasonIdLookupRequest,
        {
          seriesId: tvSeriesId,
          seasonNumber: seasonNumber,
          episodeNumber: episodeNumber,
        },
      );

    if (tvSeriesIdFetchResponse.dionysus_tv_episodes.length <= 0) {
      throw new NotFoundException();
    }

    return tvSeriesIdFetchResponse.dionysus_tv_episodes[0].id;
  }
}
