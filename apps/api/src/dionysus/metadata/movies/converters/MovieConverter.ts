import {
  AlternativeTitle,
  CountryAssociation,
  ExternalId,
  GenreAssociation,
  KeywordAssociation,
  LanguageAssociation,
  Movie,
  MovieCastMember,
  MovieCrewMember,
  MovieReleaseDate,
  MovieWithCredits,
  ProductionCompanyAssociation,
  SparseMovie,
  TypedImage,
  Video,
} from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlReleaseDate } from "../../types/metadata";
import {
  GraphQlMovie,
  GraphQlMovieWithCredits,
  GraphQlSparseMovie,
} from "../types/movie";
import {
  toAlternativeTitleDomainObject,
  toExternalIdDomainObject,
  toTypedImageDomainObject,
  toVideoDomainObject,
} from "../../converters/common";
import { toDomainObject as toAssetDomainObject } from "../../../media/assets/converters/MediaAssetConverter";
import { toDomainObject as toSearchConfigurationDomainObject } from "../../../media/searchConfigurations/converters/MediaAssetSearchConfigurationConverter";
import {
  toDomainObject as toCountryDomainObject,
  toCountryAssociationDomainObject,
} from "../../countries/converters/CountryConverter";
import { toDomainObject as toCertificationDomainObject } from "../../certifications/converters/CertificationConverter";
import {
  toDomainObject as toLanguageDomainObject,
  toLanguageAssociationDomainObject,
} from "../../languages/converters/LanguageConverter";
import { toSparseDomainObject as toMediaFavoriteDomainObject } from "../../../media/favorites/converters/MediaFavoriteConverter";
import { toMovieCastDomainObject } from "../../converters/CastConverter";
import { toMovieCrewDomainObject } from "../../converters/CrewConverter";
import { toGenreAssociationDomainObject } from "../../genres/converters/GenreConverter";
import { toKeywordAssociationDomainObject } from "../../keywords/converters/KeywordConverter";
import { toProductionCompanyAssociationDomainObject } from "../../productionCompanies/converters/ProductionCompanyConverter";

export const toDomainObject = (input: GraphQlMovie): Movie => {
  const alternativeTitles: AlternativeTitle[] = [];
  const externalIds: ExternalId[] = [];
  const images: TypedImage[] = [];
  const keywords: KeywordAssociation[] = [];
  const productionCountries: CountryAssociation[] = [];
  const productionCompanies: ProductionCompanyAssociation[] = [];
  const releaseDates: MovieReleaseDate[] = [];
  const spokenLanguages: LanguageAssociation[] = [];
  const videos: Video[] = [];

  if (input.alternativeTitles) {
    input.alternativeTitles.forEach((entity) => {
      alternativeTitles.push(toAlternativeTitleDomainObject(entity));
    });
  }

  if (input.externalIds) {
    input.externalIds.forEach((entity) => {
      externalIds.push(toExternalIdDomainObject(entity));
    });
  }

  if (input.images) {
    input.images.forEach((entity) => {
      images.push(toTypedImageDomainObject(entity));
    });
  }

  if (input.keywords) {
    input.keywords.forEach((entity) => {
      if (entity.keyword) {
        keywords.push(toKeywordAssociationDomainObject(entity));
      }
    });
  }

  if (input.productionCountries) {
    input.productionCountries.forEach((entity) => {
      if (entity.country) {
        productionCountries.push(toCountryAssociationDomainObject(entity));
      }
    });
  }

  if (input.productionCompanies) {
    input.productionCompanies.forEach((entity) => {
      if (entity.productionCompany) {
        productionCompanies.push(
          toProductionCompanyAssociationDomainObject(entity),
        );
      }
    });
  }

  if (input.releaseDates) {
    input.releaseDates.forEach((entity) => {
      releaseDates.push(toMovieReleaseDateDomainObject(entity));
    });
  }

  if (input.spokenLanguages) {
    input.spokenLanguages.forEach((entity) => {
      if (entity.language) {
        spokenLanguages.push(toLanguageAssociationDomainObject(entity));
      }
    });
  }

  if (input.videos) {
    input.videos.forEach((entity) => {
      videos.push(toVideoDomainObject(entity));
    });
  }

  return {
    ...toSparseDomainObject(input),
    alternativeTitles: alternativeTitles,
    externalIds: externalIds,
    images: images,
    keywords: keywords,
    originalLanguage: input.originalLanguage
      ? toLanguageDomainObject(input.originalLanguage)
      : undefined,
    productionCompanies: productionCompanies,
    productionCountries: productionCountries,
    releaseDates: releaseDates,
    spokenLanguages: spokenLanguages,
    videos: videos,
  };
};

export const toDomainObjectWithCredits = (
  input: GraphQlMovieWithCredits,
): MovieWithCredits => {
  const cast: MovieCastMember[] = [];
  const crew: MovieCrewMember[] = [];

  if (input.cast) {
    input.cast.forEach((entity) => {
      if (entity.person) {
        cast.push(toMovieCastDomainObject(entity));
      }
    });
  }

  if (input.crew) {
    input.crew.forEach((entity) => {
      if (entity.person) {
        crew.push(toMovieCrewDomainObject(entity));
      }
    });
  }

  return {
    ...toDomainObject(input),
    cast: cast,
    crew: crew,
  };
};

export const toSparseDomainObject = (
  input: GraphQlSparseMovie,
): SparseMovie => {
  const genres: GenreAssociation[] = [];

  if (input.genres) {
    input.genres.forEach((entity) => {
      if (entity.genre) {
        genres.push(toGenreAssociationDomainObject(entity));
      }
    });
  }

  return {
    adult: input.adult,
    backdropPath: input.backdropPath,
    budget: input.budget,
    createdTime: moment(input.createdTime),
    homepage: input.homepage,
    id: input.id,
    imdbId: input.imdbId,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    originalTitle: input.originalTitle,
    overview: input.overview,
    popularity: input.popularity,
    posterPath: input.posterPath,
    releaseDate: input.releaseDate ? moment.utc(input.releaseDate) : undefined,
    revenue: input.revenue,
    runtime: input.runtime,
    status: input.status,
    tagline: input.tagline,
    title: input.title,
    voteAverage: input.voteAverage,
    voteCount: input.voteCount,
    video: input.video,
    genres: genres,
    searchConfiguration: input.searchConfiguration
      ? toSearchConfigurationDomainObject(input.searchConfiguration)
      : undefined,
    asset: input.asset ? toAssetDomainObject(input.asset) : undefined,
    favorite: input.favorite
      ? toMediaFavoriteDomainObject(input.favorite)
      : undefined,
  };
};

export const toMovieReleaseDateDomainObject = (
  input: GraphQlReleaseDate,
): MovieReleaseDate => {
  return {
    country: input.country ? toCountryDomainObject(input.country) : undefined,
    certification: input.certification
      ? toCertificationDomainObject(input.certification)
      : undefined,
    createdTime: moment(input.createdTime),
    language: input.language
      ? toLanguageDomainObject(input.language)
      : undefined,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    releaseDate: moment.utc(input.releaseDate),
    note: input.note,
    type: input.type,
  };
};
