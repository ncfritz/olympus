import { SPARSE_MEDIA_FAVORITE } from "../media/mediaFavorite";
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
  VIDEOS
} from "./common";
import { GENRES } from "./genres";
import { KEYWORDS } from "./keywords";
import { NETWORKS } from "./networks";
import { BASE_PERSON } from "./people";
import { PRODUCTION_COMPANIES } from "./productionCompany";
import { SPARSE_TV_EPISODE } from "./tvEpisode";
import { SPARSE_TV_SEASON } from "./tvSeason";

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
  populatiry
  status
  tagline
  type
  voteCount
  voteAverage
  createdTime
  lastUpdatedTime
  ${SEARCH_CONFIGURATION}
  ${SPARSE_MEDIA_FAVORITE}
 `;

export const SPARSE_TV_SERIES = `${BASE_TV_SERIES}
  originalLanguage {
    ${BASE_LANGUAGE}
  }
  ${ALTERNATIVE_TITLES}
  ${CERTIFICATIONS}
  ${TV_EPISODE_RUNTIMES}
  ${EXTERNAL_IDS}
  ${GENRES}
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
  seasons {
    ${SPARSE_TV_SEASON}
  }
  ${VIDEOS}
  `;

export const TV_SERIES_CAST_MEMBER_ROLE = `creditId
  character
  episodecount
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
