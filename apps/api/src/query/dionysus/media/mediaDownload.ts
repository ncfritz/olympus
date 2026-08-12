import { MEDIA_ASSET_WORKFLOW_DECORATION } from "./common";

export const BASE_MEDIA_DOWNLOAD = `id
    nzbId
    assetType
    mediaId
    workflowId
    searchResultId
    status
    progress
    startedTime
    finishedTime
    createdTime
    lastUpdatedTime`;

export const BASE_DECORATED_MEDIA_DOWNLOAD = `${BASE_MEDIA_DOWNLOAD}
  decoration {
    ${MEDIA_ASSET_WORKFLOW_DECORATION}
  }`;
