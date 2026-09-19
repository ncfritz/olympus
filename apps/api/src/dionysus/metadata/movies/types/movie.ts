import { GraphQlMediaAsset } from "../../../media/assets/types/mediaAsset";
import { GraphQlMediaFavorite } from "../../../media/favorites/types/mediaFavorite";
import { GraphQlMediaAssetSearchConfiguration } from "../../../media/searchConfigurations/types/searchConfiguration";
import { GraphQlVideo, Timestamped } from "../../types/metadata";
import {
  GraphQlAlternativeTitle,
  GraphQlExternalId,
  GraphQlMovieCastMember,
  GraphQlMovieCrewMember,
  GraphQlReleaseDate,
  GraphQlTypedImage,
} from "../../types/metadata";
import { GraphQlCountryWrapper } from "../../countries/types/country";
import { GraphQlGenreWrapper } from "../../genres/types/genre";
import { GraphQlKeywordWrapper } from "../../keywords/types/keyword";
import {
  GraphQlLanguage,
  GraphQlLanguageWrapper,
} from "../../languages/types/language";
import { GraphQlProductionCompanyWrapper } from "../../productionCompanies/types/productionCompany";

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
