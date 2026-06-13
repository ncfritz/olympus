import { MEDIA_ASSET } from "../media/mediaAsset";
import { SPARSE_MEDIA_FAVORITE } from "../media/mediaFavorite";
import { SEARCH_CONFIGURATION } from "../media/searchConfigutation";
import { EXTERNAL_IDS, TYPED_IMAGES, VIDEOS } from "./common";
import { BASE_PERSON } from "./people";
import { SPARSE_TV_SEASON } from "./tvSeason";
import { BASE_TV_SERIES } from "./tvSeries";

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
  voteAverage
`;

export const SPARSE_TV_EPISODE = `${BASE_TV_EPISODE}
  createdTime
  lastModifiedTime
  ${SEARCH_CONFIGURATION}
  ${SPARSE_MEDIA_FAVORITE}
  ${MEDIA_ASSET}`;

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
