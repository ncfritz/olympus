import { MEDIA_ASSET_WORKFLOW_DECORATION } from "./common";

export const BASE_MEDIA_FAVORITE = `createdTime`;

export const SPARSE_MEDIA_FAVORITE = `favorite {
    ${BASE_MEDIA_FAVORITE}
  }`;

export const DECORATED_MEDIA_FAVORITE = `${BASE_MEDIA_FAVORITE}
  decoration {
    ${MEDIA_ASSET_WORKFLOW_DECORATION}
  }
`;

export const MEDIA_FAVORITE = `favorite {
    ${DECORATED_MEDIA_FAVORITE}
  }`;
