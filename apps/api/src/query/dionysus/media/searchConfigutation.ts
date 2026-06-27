import { MEDIA_ASSET_WORKFLOW_DECORATION } from "./mediaAssetWorkflow";

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

export const BASE_DECORATED_SEARCH_CONFIGURATION = `
  ${BASE_SEARCH_CONFIGURATION}
  decoration {
    ${MEDIA_ASSET_WORKFLOW_DECORATION}
  }`;

export const SEARCH_CONFIGURATION = `searchConfiguration {
  ${BASE_SEARCH_CONFIGURATION}
}`;
