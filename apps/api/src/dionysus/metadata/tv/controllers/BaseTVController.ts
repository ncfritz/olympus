import { NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";

type GraphQlTvSeasonIdLookupResponse = {
  dionysus_tv_seasons: {
    id: number;
  }[];
};

type GraphQlTvEpisodeIdLookupResponse = {
  dionysus_tv_episodes: {
    id: number;
  }[];
};

export class BaseTVController {
  protected readonly graphQLClient: GraphQLClient;

  protected constructor(graphQLClient: GraphQLClient) {
    this.graphQLClient = graphQLClient;
  }

  protected async lookupMediaIdForTvSeason(
    tvSeriesId: number,
    seasonNumber: number,
  ) {
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

  protected async lookupMediaIdForTvEpisode(
    tvSeriesId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
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
