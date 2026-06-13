import { GraphQlMediaFavorite } from "../media/mediaFavorite";
import { GraphQlMediaAssetSearchConfiguration } from "../media/searchConfiguration";
import {
  GraphQlAlternativeTitle,
  GraphQlExternalId,
  GraphQlTypedImage,
  GraphQlVideo,
  Timestamped,
  Wrapped,
} from "../metadata";
import { GraphQlCertificationWrapper } from "./certification";
import { GraphQlCountryWrapper } from "./country";
import { GraphQlGenreWrapper } from "./genre";
import { GraphQlKeywordWrapper } from "./keyword";
import { GraphQlLanguage, GraphQlLanguageWrapper } from "./language";
import { GraphQlBasePerson } from "./person";
import { GraphQlProductionCompanyWrapper } from "./productionCompany";
import { GraphQlSparseTvEpisode } from "./tvEpisode";
import { GraphQlNetworkyWrapper } from "./tvNetworks";
import { GraphQlSparseTvSeason } from "./tvSeason";

export type GraphQlBaseTvSeries = Timestamped & {
  adult: boolean;
  backdropPath: string;
  firstAirDate: string;
  homepage: string;
  id: number;
  inProduction: boolean;
  lastAirDate: string;
  name: string;
  numberOfEpisodes: number;
  numberOfSeasons: number;
  originalName: string;
  overview: string;
  popularity: number;
  posterPath: string;
  status: string;
  tagline: string;
  type: string;
  voteAverage: number;
  voteCount: number;
  searchConfiguration?: GraphQlMediaAssetSearchConfiguration;
  favorite?: GraphQlMediaFavorite;
};

export type GraphQlSparseTvSeries = GraphQlBaseTvSeries & {
  originalLanguage: GraphQlLanguage;
  alternativeTitles: GraphQlAlternativeTitle[];
  certifications: GraphQlCertificationWrapper[];
  episodeRuntimes: GraphQlTvSeriesRuntime[];
  externalIds: GraphQlExternalId[];
  genres: GraphQlGenreWrapper[];
  keywords: GraphQlKeywordWrapper[];
  languages: GraphQlLanguageWrapper[];
  originCountries: GraphQlCountryWrapper[];
  spokenLanguages: GraphQlLanguageWrapper[];
};

export type GraphQlTvSeries = GraphQlSparseTvSeries & {
  createdBy: GraphQlTvSeriesCreatedBy[];
  lastEpisodeToAir: GraphQlSparseTvEpisode;
  nextEpisodeToAir: GraphQlSparseTvEpisode;
  images: GraphQlTypedImage[];
  networks: GraphQlNetworkyWrapper[];
  productionCompanies: GraphQlProductionCompanyWrapper[];
  productionCountries: GraphQlCountryWrapper[];
  seasons: GraphQlSparseTvSeason[];
  videos: GraphQlVideo[];
};

export type GraphQlTvSeriesRuntime = Timestamped & {
  runTime: number;
};

export type GraphQlTvSeriesCreatedBy = Timestamped &
  Wrapped<GraphQlBasePerson, "person"> & {
    creditId: string;
  };

export type GraphQlTvSeriesCastMemberRole = Timestamped & {
  character: string;
  creditId: string;
  episodeCount: number;
};

export type GraphQlTvSeriesCastMember = Timestamped & {
  order: number;
  originalName: string;
  totalEpisodeCount: number;
  roles: GraphQlTvSeriesCastMemberRole[];
  person: GraphQlBasePerson;
};

export type GraphQlTvSeriesCrewMemberJob = Timestamped & {
  job: string;
  creditId: string;
  episodeCount: number;
};

export type GraphQlTvSeriesCrewMember = Timestamped & {
  department: string;
  order: number;
  originalName: string;
  totalEpisodeCount: number;
  jobs: GraphQlTvSeriesCrewMemberJob[];
  person: GraphQlBasePerson;
};

export type GraphQlTvSeriesRecommendation = Timestamped & {
  tvSeries: GraphQlBaseTvSeries;
};
