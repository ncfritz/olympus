import { MEDIA_ASSET_WORKFLOW_DECORATION } from "./common";
import { BASE_MEDIA_DOWNLOAD } from "./mediaDownload";

export const BASE_MEDIA_ASSET_WORKFLOW_STEP = `id
  assetType
  mediaId
  type
  status
  progress  
  createdTime
  lastUpdatedTime
  startedTime
  finishedTime`;

export const MEDIA_ASSET_WORKFLOW_STEP = `${BASE_MEDIA_ASSET_WORKFLOW_STEP}
  subSteps(order_by: { createdTime: asc }) {
    ${BASE_MEDIA_ASSET_WORKFLOW_STEP}
  }
`;

export const BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP = `${BASE_MEDIA_ASSET_WORKFLOW_STEP}
  decoration {
    ${MEDIA_ASSET_WORKFLOW_DECORATION}
  }`;

export const BASE_MEDIA_ASSET_WORKFLOW = `id
  type
  mediaId
  status
  startedTime
  finishedTime
  createdTime
  lastUpdatedTime
  download {
    ${BASE_MEDIA_DOWNLOAD}
  }
  steps(order_by: { createdTime: asc }, where: {parent_step_id: {_is_null: true}}) {
    ${MEDIA_ASSET_WORKFLOW_STEP}
  }
`;

export const DECORATED_MEDIA_ASSET_WORKFLOW = `${BASE_MEDIA_ASSET_WORKFLOW}
  decoration {
    ${MEDIA_ASSET_WORKFLOW_DECORATION}
  }
`;
