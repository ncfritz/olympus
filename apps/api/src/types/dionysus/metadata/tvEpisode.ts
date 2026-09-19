import { GraphQlMediaAsset } from "../media/mediaAsset";
import { GraphQlMediaFavorite } from "../media/mediaFavorite";
import { GraphQlMediaAssetSearchConfiguration } from "../media/searchConfiguration";
import {
  GraphQlExternalId,
  GraphQlTypedImage,
  GraphQlVideo,
  Timestamped,
} from "../metadata";
import { GraphQlBasePerson } from "./person";
import { GraphQlSparseTvSeason } from "./tvSeason";
import { GraphQlSparseTvSeries } from "./tvSeries";

export type GraphQlSparseTvEpisode = Timestamped & {
  id: number;
  episodeNumber: number;
  airDate: string;
  name: string;
  overview: string;
  productionCode: string;
  runtime: number;
  seasonNumber: number;
  stillPath: string;
  voteAverage: number;
  voteCount: number;
  searchConfiguration?: GraphQlMediaAssetSearchConfiguration;
  asset?: GraphQlMediaAsset;
  favorite?: GraphQlMediaFavorite;
};

export type GraphQlTvEpisode = GraphQlSparseTvEpisode & {
  series: GraphQlSparseTvSeries | null;
  season: GraphQlSparseTvSeason | null;
  externalIds: GraphQlExternalId[];
  images: GraphQlTypedImage[];
  videos: GraphQlVideo[];
};

export type GraphQlTvEpisodeCastMember = Timestamped & {
  character: string;
  creditId: string;
  order: number;
  person: GraphQlBasePerson;
  originalName: string;
};

export type GraphQlTvEpisodeCrewMember = Timestamped & {
  job: string;
  creditId: string;
  department: string;
  person: GraphQlBasePerson;
  originalName: string;
};
