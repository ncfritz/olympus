import { GraphQlMediaAsset } from "../media/mediaAsset";
import { GraphQlMediaFavorite } from "../media/mediaFavorite";
import { GraphQlMediaAssetSearchConfiguration } from "../media/searchConfiguration";
import { GraphQlVideo, Timestamped } from "../metadata";
import {
  GraphQlAlternativeTitle,
  GraphQlExternalId,
  GraphQlMovieCastMember,
  GraphQlMovieCrewMember,
  GraphQlReleaseDate,
  GraphQlTypedImage,
} from "../metadata";
import { GraphQlCountryWrapper } from "./country";
import { GraphQlGenreWrapper } from "./genre";
import { GraphQlKeywordWrapper } from "./keyword";
import { GraphQlLanguage, GraphQlLanguageWrapper } from "./language";
import { GraphQlProductionCompanyWrapper } from "./productionCompany";

export type GraphQlSparseMovie = {
  adult: boolean;
  backdropPath?: string;
  budget: number;
  createdTime: string;
  homepage: string;
  id: number;
  imdbId?: string;
  lastUpdatedTime: string;
  originalTitle: string;
  overview: string;
  popularity: number;
  posterPath?: string;
  releaseDate?: string;
  revenue: number;
  runtime: number;
  status: string;
  tagline: string;
  title: string;
  video: boolean;
  voteCount: number;
  voteAverage: number;
  genres: GraphQlGenreWrapper[];
  originalLanguage: GraphQlLanguage | null;
  searchConfiguration: GraphQlMediaAssetSearchConfiguration;
  asset?: GraphQlMediaAsset;
  favorite?: GraphQlMediaFavorite;
};

export type GraphQlMovie = GraphQlSparseMovie & {
  alternativeTitles: GraphQlAlternativeTitle[];
  externalIds: GraphQlExternalId[];
  images: GraphQlTypedImage[];
  keywords: GraphQlKeywordWrapper[];
  productionCountries: GraphQlCountryWrapper[];
  productionCompanies: GraphQlProductionCompanyWrapper[];
  releaseDates: GraphQlReleaseDate[];
  spokenLanguages: GraphQlLanguageWrapper[];
  videos: GraphQlVideo[];
};

export type GraphQlMovieWithCredits = GraphQlMovie & {
  cast: GraphQlMovieCastMember[];
  crew: GraphQlMovieCrewMember[];
};

export type GraphQlMovieRecommendation = Timestamped & {
  movie: GraphQlSparseMovie;
};
