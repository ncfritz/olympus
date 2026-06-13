import { SortDirection } from "@ncfritz/olympus-model";
import { SPARSE_MEDIA_FAVORITE } from "../media/mediaFavorite";
import { SEARCH_CONFIGURATION } from "../media/searchConfigutation";
import {
  EXTERNAL_IDS,
  SPARSE_TV_EPISODES,
  TYPED_IMAGES,
  VIDEOS,
} from "./common";
import { BASE_TV_SERIES } from "./tvSeries";

export const BASE_TV_SEASON = `id
  airDate
  name
  overview
  posterPath
  seasonNumber
  voteAverage
  `;

export const SPARSE_TV_SEASON = `${BASE_TV_SEASON}
  createdTime
  lastUpdatedTime
  episodes_aggregate {
    aggregate {
      count
    }
  }
  ${SEARCH_CONFIGURATION}
  ${SPARSE_MEDIA_FAVORITE}
  `;

export const TV_SEASON = `${SPARSE_TV_SEASON}
  series {
    ${BASE_TV_SERIES}
  }
  ${SPARSE_TV_EPISODES({ field: "episodeNumber", order: SortDirection.ASC })}
  ${EXTERNAL_IDS}
  ${TYPED_IMAGES}
  ${VIDEOS}`;
