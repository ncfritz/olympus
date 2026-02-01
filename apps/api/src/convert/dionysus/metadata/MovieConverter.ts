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
import { GraphQlReleaseDate } from "../../../types/dionysus/metadata";
import {
  GraphQlMovie,
  GraphQlMovieWithCredits,
  GraphQlSparseMovie,
} from "../../../types/dionysus/metadata/movie";
import {
  toAlternativeTitleDomainObject,
  toExternalIdDomainObject,
  toTypedImageDomainObject,
  toVideoDomainObject,
} from "./common";
import { toDomainObject as toSearchConfigurationDomainObject } from "../media/MediaAssetSearchConfigurationConverter";
import {
  toDomainObject as toCountryDomainObject,
  toCountryAssociationDomainObject,
} from "./CountryConverter";
import { toDomainObject as toCertificationDomainObject } from "./CertificationConverter";
import {
  toDomainObject as toLanguageDomainObject,
  toLanguageAssociationDomainObject,
} from "./LanguageConverter";
import { toMovieCastDomainObject } from "./CastConverter";
import { toMovieCrewDomainObject } from "./CrewConverter";
import { toGenreAssociationDomainObject } from "./GenreConverter";
import { toKeywordAssociationDomainObject } from "./KeywordConverter";
import { toProductionCompanyAssociationDomainObject } from "./ProductionCompanyConverter";

export const toDomainObject = (input: GraphQlMovie): Movie => {
  const alternativeTitles: AlternativeTitle[] = [];
  const externalIds: ExternalId[] = [];
  const genres: GenreAssociation[] = [];
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

  if (input.genres) {
    input.genres.forEach((entity) => {
      genres.push(toGenreAssociationDomainObject(entity));
    });
  }

  if (input.images) {
    input.images.forEach((entity) => {
      images.push(toTypedImageDomainObject(entity));
    });
  }

  if (input.keywords) {
    input.keywords.forEach((entity) => {
      keywords.push(toKeywordAssociationDomainObject(entity));
    });
  }

  if (input.productionCountries) {
    input.productionCountries.forEach((entity) => {
      productionCountries.push(toCountryAssociationDomainObject(entity));
    });
  }

  if (input.productionCompanies) {
    input.productionCompanies.forEach((entity) => {
      productionCompanies.push(
        toProductionCompanyAssociationDomainObject(entity),
      );
    });
  }

  if (input.releaseDates) {
    input.releaseDates.forEach((entity) => {
      releaseDates.push(toMovieReleaseDateDomainObject(entity));
    });
  }

  if (input.spokenLanguages) {
    input.spokenLanguages.forEach((entity) => {
      spokenLanguages.push(toLanguageAssociationDomainObject(entity));
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
    genres: genres,
    images: images,
    keywords: keywords,
    originalLanguage: toLanguageDomainObject(input.originalLanguage),
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
    releaseDate: input.releaseDate ? moment(input.releaseDate) : undefined,
    revenue: input.revenue,
    runtime: input.runtime,
    status: input.status,
    tagline: input.tagline,
    title: input.title,
    voteAverage: input.voteAverage,
    voteCount: input.voteCount,
    video: input.video,
    searchConfiguration: input.searchConfiguration
      ? toSearchConfigurationDomainObject(input.searchConfiguration)
      : undefined,
  };
};

export const toMovieReleaseDateDomainObject = (
  input: GraphQlReleaseDate,
): MovieReleaseDate => {
  return {
    country: toCountryDomainObject(input.country),
    certification: input.certification
      ? toCertificationDomainObject(input.certification)
      : undefined,
    createdTime: moment(input.createdTime),
    language: input.language
      ? toLanguageDomainObject(input.language)
      : undefined,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    releaseDate: moment(input.releaseDate),
    note: input.note,
    type: input.type,
  };
};
