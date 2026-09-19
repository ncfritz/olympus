import { GraphQlMediaFavorite } from "../media/mediaFavorite";
import { GraphQlMediaAssetSearchConfiguration } from "../media/searchConfiguration";
import {
  GraphQlExternalId,
  GraphQlTypedImage,
  GraphQlVideo,
  Timestamped,
} from "../metadata";
import { GraphQlSparseTvEpisode } from "./tvEpisode";
import { GraphQlSparseTvSeries } from "./tvSeries";

export type GraphQlSparseTvSeason = Timestamped & {
  id: number;
  airDate: string;
  name: string;
  overview: string;
  posterPath: string;
  seasonNumber: number;
  episodeCount: number;
  voteAverage: number;
  episodes_aggregate: {
    aggregate: {
      count: number;
    };
  };
  searchConfiguration?: GraphQlMediaAssetSearchConfiguration;
  favorite?: GraphQlMediaFavorite;
};

export type GraphQlTvSeason = GraphQlSparseTvSeason & {
  series: GraphQlSparseTvSeries | null;
  externalIds: GraphQlExternalId[];
  images: GraphQlTypedImage[];
  videos: GraphQlVideo[];
  episodes: GraphQlSparseTvEpisode[];
};
