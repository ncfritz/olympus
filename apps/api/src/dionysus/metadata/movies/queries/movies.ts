import { MEDIA_ASSET } from "../../../media/assets/queries/mediaAsset";
import { SPARSE_MEDIA_FAVORITE } from "../../../media/favorites/queries/mediaFavorite";
import { SEARCH_CONFIGURATION } from "../../../media/searchConfigurations/queries/searchConfiguration";
import { BASE_CERTIFICATION } from "../../certifications/queries/certifications";
import {
  ALTERNATIVE_TITLES,
  BASE_COUNTRY,
  BASE_LANGUAGE,
  COUNTRY_ASSOCIATION,
  EXTERNAL_IDS,
  LANGUAGE_ASSOCIATION,
  TYPED_IMAGES,
  VIDEOS,
} from "../../queries/common";
import { GENRES } from "../../genres/queries/genres";
import { KEYWORDS } from "../../keywords/queries/keywords";
import { BASE_PERSON } from "../../people/queries/people";
import { PRODUCTION_COMPANIES } from "../../productionCompanies/queries/productionCompany";

export const BASE_MOVIE_RELEASE_DATE = `type
  note
  releaseDate
  createdTime
  lastUpdatedTime
  certification {
    ${BASE_CERTIFICATION}
  }
  country {
    ${BASE_COUNTRY}
  }
  language {
    ${BASE_LANGUAGE}
  }`;

export const MOVIE_RELEASE_DATES = `releaseDates {
    ${BASE_MOVIE_RELEASE_DATE}
  }`;

export const BASE_MOVIE = `id
  adult
  backdropPath
  budget
  homepage
  imdbId
  originalTitle
  overview
  popularity
  posterPath
  releaseDate
  revenue
  runtime
  status
  tagline
  title
  video
  voteCount
  voteAverage`;

export const MOVIE_SUMMARY = `id
  adult
  backdropPath
  budget
  homepage
  imdbId
  originalTitle
  overview
  posterPath
  releaseDate
  revenue
  runtime
  status
  tagline
  title
  video
  createdTime
  lastUpdatedTime`;

export const MOVIE_SUMMARY_WITH_ORIGINAL_LANGUAGE = `${MOVIE_SUMMARY}
  originalLanguageCode`;

export const MOVIE_SUMMARY_WITH_SEARCH_CONFIGURATION = `${MOVIE_SUMMARY}
  ${SEARCH_CONFIGURATION}`;

export const MOVIE_COLUMNS = `${MOVIE_SUMMARY_WITH_ORIGINAL_LANGUAGE}
  popularity
  voteCount
  voteAverage`;

export const SPARSE_MOVIE = `${BASE_MOVIE}
  createdTime
  lastUpdatedTime
  ${GENRES}
  ${MEDIA_ASSET}
  ${SPARSE_MEDIA_FAVORITE}
  ${SEARCH_CONFIGURATION}`;

export const MOVIE = `${SPARSE_MOVIE}
  ${ALTERNATIVE_TITLES}
  ${EXTERNAL_IDS}
  ${TYPED_IMAGES}
  ${KEYWORDS}
  originalLanguage {
    ${BASE_LANGUAGE}
  }
  ${PRODUCTION_COMPANIES}
  productionCountries {
    ${COUNTRY_ASSOCIATION}
  }
  ${MOVIE_RELEASE_DATES}
  spokenLanguages {
    ${LANGUAGE_ASSOCIATION}
  }
  ${VIDEOS}`;

export const BASE_MOVIE_RECOMMENDATION = `movie {
    ${SPARSE_MOVIE}
  }`;

export const SPARSE_MOVIE_CAST_MEMBER = `castId
  originalName
  creditId
  order
  character
  createdTime
  lastUpdatedTime`;

export const MOVIE_CAST_MEMBER = `${SPARSE_MOVIE_CAST_MEMBER}
  person {
    ${BASE_PERSON}
  }`;

export const SPARSE_MOVIE_CREW_MEMBER = `creditId
  originalName
  department
  job
  createdTime
  lastUpdatedTime`;

export const MOVIE_CREW_MEMBER = `${SPARSE_MOVIE_CREW_MEMBER}
  person {
    ${BASE_PERSON}
  }`;
