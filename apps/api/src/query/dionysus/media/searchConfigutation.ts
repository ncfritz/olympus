import { MEDIA_ASSET_WORKFLOW_DECORATION } from "./common";
import { BASE_SEARCH_EXECUTION } from "./searchExecution";

export const BASE_SEARCH_CONFIGURATION = `assetType
  backoff
  createdTime
  enabled
  status
  episodeNumber
  jitter
  lastExecutionTime
  lastModifiedTime
  mediaId
  nextExecutionTime
  seasonNumber
  seriesId`;

export const BASE_DECORATED_SEARCH_CONFIGURATION = `${BASE_SEARCH_CONFIGURATION}
  decoration {
    ${MEDIA_ASSET_WORKFLOW_DECORATION}
  }`;

export const SEARCH_CONFIGURATION = `searchConfiguration {
  ${BASE_SEARCH_CONFIGURATION}
}`;

export const BASE_SEARCH_CONFIGURATION_LIST_ITEM = `${BASE_DECORATED_SEARCH_CONFIGURATION}
  searchExecutions(order_by: { finishedTime: desc }, limit: 30) {
    ${BASE_SEARCH_EXECUTION}
  }
`;
