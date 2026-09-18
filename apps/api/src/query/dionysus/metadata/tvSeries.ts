import { SortDirection } from "@ncfritz/olympus-model";
import { MEDIA_ASSET } from "../media/mediaAsset";
import { MEDIA_FAVORITE, SPARSE_MEDIA_FAVORITE } from "../media/mediaFavorite";
import { SEARCH_CONFIGURATION } from "../media/searchConfigutation";
import { CERTIFICATIONS } from "./certifications";
import {
  ALTERNATIVE_TITLES,
  BASE_LANGUAGE,
  COUNTRY_ASSOCIATION,
  EXTERNAL_IDS,
  LANGUAGE_ASSOCIATION,
  LANGUAGES,
  TV_EPISODE_RUNTIMES,
  TYPED_IMAGES,
  VIDEOS,
} from "./common";
import { GENRES } from "./genres";
import { KEYWORDS } from "./keywords";
import { NETWORKS } from "./networks";
import { BASE_PERSON } from "./people";
import { PRODUCTION_COMPANIES } from "./productionCompany";

export const BASE_TV_SEASON = `id
  airDate
  name
  overview
  posterPath
  seasonNumber
  voteAverage`;

export const SPARSE_TV_SEASON = `${BASE_TV_SEASON}
  createdTime
  lastUpdatedTime
  episodes_aggregate {
    aggregate {
      count
    }
  }
  ${SEARCH_CONFIGURATION}
  ${SPARSE_MEDIA_FAVORITE}`;

export const BASE_TV_EPISODE = `id
  airDate
  episodeNumber
  name
  overview
  productionCode
  runtime
  seasonNumber
  stillPath
  voteCount
  voteAverage`;

export const SPARSE_TV_EPISODE = `${BASE_TV_EPISODE}
  createdTime
  lastUpdatedTime
  ${SEARCH_CONFIGURATION}
  ${MEDIA_FAVORITE}
  ${MEDIA_ASSET}`;

export const BASE_TV_EPISODE_CREW_MEMBER = `creditId
  job
  department
  person {
    ${BASE_PERSON}
  }
  originalName
  createdTime
  lastUpdatedTime`;

export const SPARSE_TV_EPISODE_CAST_MEMBER = `character
  creditId
  order
  originalName
  createdTime
  lastUpdatedTime`;

export const TV_EPISODE_CAST_MEMBER = `${SPARSE_TV_EPISODE_CAST_MEMBER}
  person {
    ${BASE_PERSON}
  }`;

export const TV_SERIES_CREATED_BY = `createdBy {
  creditId
    createdTime
    lastUpdatedTime
    person {
      ${BASE_PERSON}
    }
  }`;

export const BASE_TV_SERIES = `id
  adult
  backdropPath
  firstAirDate
  homepage
  inProduction
  lastAirDate
  name
  numberOfEpisodes
  numberOfSeasons
  originalName
  overview
  posterPath
  popularity
  status
  tagline
  type
  voteCount
  voteAverage
  createdTime
  lastUpdatedTime
  ${GENRES}
  ${SEARCH_CONFIGURATION}
  ${SPARSE_MEDIA_FAVORITE}`;

export const SPARSE_TV_SERIES = `${BASE_TV_SERIES}
  originalLanguage {
    ${BASE_LANGUAGE}
  }
  ${ALTERNATIVE_TITLES}
  ${CERTIFICATIONS}
  ${TV_EPISODE_RUNTIMES}
  ${EXTERNAL_IDS}
  ${KEYWORDS}
  ${LANGUAGES}
  originCountries {
    ${COUNTRY_ASSOCIATION}
  }
  spokenLanguages {
    ${LANGUAGE_ASSOCIATION}
  }`;

export const TV_SERIES = `${SPARSE_TV_SERIES}
  lastEpisodeToAir {
    ${SPARSE_TV_EPISODE}
  }
  nextEpisodeToAir {
    ${SPARSE_TV_EPISODE}
  }
  ${TV_SERIES_CREATED_BY}
  ${TYPED_IMAGES}
  ${NETWORKS}
  ${PRODUCTION_COMPANIES}
  productionCountries {
    ${COUNTRY_ASSOCIATION}
  }
  seasons(order_by: { seasonNumber: asc }) {
    ${SPARSE_TV_SEASON}
  }
  ${VIDEOS}`;

export const TV_SERIES_CAST_MEMBER_ROLE = `creditId
  character
  episodeCount
  createdTime
  lastUpdatedTime`;

export const SPARSE_TV_SERIES_CAST_MEMBER = `order
  originalName
  totalEpisodeCount
  createdTime
  lastUpdatedTime
  roles {
    ${TV_SERIES_CAST_MEMBER_ROLE}
  }`;

export const TV_SERIES_CAST_MEMBER = `${SPARSE_TV_SERIES_CAST_MEMBER}
  person {
    ${BASE_PERSON}
  }`;

export const TV_SERIES_CREW_MEMBER_JOB = `creditId
  job
  episodeCount
  createdTime
  lastUpdatedTime`;

export const SPARSE_TV_SERIES_CREW_MEMBER = `department
  jobs {
    ${TV_SERIES_CREW_MEMBER_JOB}
  }
  originalName
  totalEpisodeCount
  createdTime
  lastUpdatedTime`;

export const TV_SERIES_CREW_MEMBER = `${SPARSE_TV_SERIES_CREW_MEMBER}
  person {
    ${BASE_PERSON}
  }`;

export const TV_EPISODE = `${SPARSE_TV_EPISODE}
  series {
    ${BASE_TV_SERIES}
  }
  season {
    ${SPARSE_TV_SEASON}
  }
  ${EXTERNAL_IDS}
  ${TYPED_IMAGES}
  ${VIDEOS}`;

export const TV_SEASON = `${SPARSE_TV_SEASON}
  series {
    ${BASE_TV_SERIES}
  }
  episodes(order_by: { episodeNumber: ${SortDirection.ASC}}) {
    ${SPARSE_TV_EPISODE}
  }
  ${EXTERNAL_IDS}
  ${TYPED_IMAGES}
  ${VIDEOS}`;
