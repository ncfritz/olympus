import {
  Movie,
  MovieAlternativeTitle,
  MovieCastMember,
  MovieCrewMember,
  MovieExternalId,
  MovieGenre,
  MovieImage,
  MovieKeyword,
  MovieProductionCompany,
  MovieProductionCountry,
  MovieReleaseDate,
  MovieSpokenLanguage,
  MovieVideo,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlAlternativeTitle,
  GraphQlExternalId,
  GraphQlMovie,
  GraphQlMovieImage,
  GraphQlMovieVideo,
  GraphQlReleaseDate,
} from "../../types/dionysus/metadata";
import {
  toDomainObject as toCountryDomainObject,
  toMovieCountryDomainObject,
} from "../metadata/CountryConverter";
import { toDomainObject as toCertificationDomainObject } from "../metadata/CertificationConverter";
import {
  toDomainObject as toLanguageDomainObject,
  toMovieSpokenLanguageDomainObject,
} from "../metadata/LanguageConverter";
import { toMovieCastDomainObject } from "./CastConverter";
import { toMovieCrewDomainObject } from "./CrewConverter";
import { toMovieGenreDomainObject } from "./GenreConverter";
import { toMovieKeywordDomainObject } from "./KeywordConverter";
import { toMovieProductionCompanyDomainObject } from "./ProductionCompanyConverter";

export const toDomainObject = (input: GraphQlMovie): Movie => {
  const alternativeTitles: MovieAlternativeTitle[] = [];
  const cast: MovieCastMember[] = [];
  const crew: MovieCrewMember[] = [];
  const externalIds: MovieExternalId[] = [];
  const genres: MovieGenre[] = [];
  const images: MovieImage[] = [];
  const keywords: MovieKeyword[] = [];
  const productionCountries: MovieProductionCountry[] = [];
  const productionCompanies: MovieProductionCompany[] = [];
  const releaseDates: MovieReleaseDate[] = [];
  const spokenLanguages: MovieSpokenLanguage[] = [];
  const videos: MovieVideo[] = [];

  if (input.alternativeTitles) {
    input.alternativeTitles.forEach((entity) => {
      alternativeTitles.push(toMovieAlternativeTitleDomainObject(entity));
    });
  }

  if (input.cast) {
    input.cast.forEach((entity) => {
      cast.push(toMovieCastDomainObject(entity));
    });
  }

  if (input.crew) {
    input.crew.forEach((entity) => {
      crew.push(toMovieCrewDomainObject(entity));
    });
  }

  if (input.externalIds) {
    input.externalIds.forEach((entity) => {
      externalIds.push(toMovieExternalIdDomainObject(entity));
    });
  }

  if (input.genres) {
    input.genres.forEach((entity) => {
      genres.push(toMovieGenreDomainObject(entity));
    });
  }

  if (input.images) {
    input.images.forEach((entity) => {
      images.push(toMovieImageDomainObject(entity));
    });
  }

  if (input.keywords) {
    input.keywords.forEach((entity) => {
      keywords.push(toMovieKeywordDomainObject(entity));
    });
  }

  if (input.productionCountries) {
    input.productionCountries.forEach((entity) => {
      productionCountries.push(toMovieCountryDomainObject(entity));
    });
  }

  if (input.productionCompanies) {
    input.productionCompanies.forEach((entity) => {
      productionCompanies.push(toMovieProductionCompanyDomainObject(entity));
    });
  }

  if (input.releaseDates) {
    input.releaseDates.forEach((entity) => {
      releaseDates.push(toMovieReleaseDateDomainObject(entity));
    });
  }

  if (input.spokenLanguages) {
    input.spokenLanguages.forEach((entity) => {
      spokenLanguages.push(toMovieSpokenLanguageDomainObject(entity));
    });
  }

  if (input.videos) {
    input.videos.forEach((entity) => {
      videos.push(toMovieVideoDomainObject(entity));
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
    posterPath: input.posterPath,
    releaseDate: input.releaseDate ? moment(input.releaseDate) : undefined,
    revenue: input.revenue,
    runtime: input.runtime,
    status: input.status,
    tagline: input.tagline,
    title: input.title,
    video: input.video,
    alternativeTitles: alternativeTitles,
    cast: cast,
    crew: crew,
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

const toMovieAlternativeTitleDomainObject = (
  input: GraphQlAlternativeTitle,
): MovieAlternativeTitle => {
  return {
    country: toCountryDomainObject(input.country),
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    title: input.title,
    type: input.type,
  };
};

export const toMovieExternalIdDomainObject = (
  input: GraphQlExternalId,
): MovieExternalId => {
  return {
    createdTime: moment(input.createdTime),
    externalId: input.externalId,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    type: input.type,
  };
};

export const toMovieImageDomainObject = (
  input: GraphQlMovieImage,
): MovieImage => {
  return {
    createdTime: moment(input.createdTime),
    filePath: input.filePath,
    height: input.height,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    width: input.width,
    type: input.type,
    language: input.language
      ? toLanguageDomainObject(input.language)
      : undefined,
  };
};

export const toMovieVideoDomainObject = (
  input: GraphQlMovieVideo,
): MovieVideo => {
  return {
    createdTime: moment(input.createdTime),
    country: toCountryDomainObject(input.country),
    type: input.type,
    key: input.key,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    name: input.name,
    id: input.id,
    official: input.official,
    publishedTime: moment(input.publishedTime),
    site: input.site,
    size: input.size,
    language: toLanguageDomainObject(input.language),
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
