import { GraphQlMediaFavorite } from "../../../media/favorites/types/mediaFavorite";
import { GraphQlMediaAssetSearchConfiguration } from "../../../media/searchConfigurations/types/searchConfiguration";
import {
  GraphQlExternalId,
  GraphQlTypedImage,
  GraphQlVideo,
  Timestamped,
} from "../../types/metadata";
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
