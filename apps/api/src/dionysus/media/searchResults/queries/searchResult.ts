import { BASE_MEDIA_DOWNLOAD } from "../../downloads/queries/mediaDownload";

export const SEARCH_RESULT_KEY = `assetType
  mediaId
  id`;

export const BASE_SEARCH_RESULT_TAG = `type
  value
  score
  createdTime`;

export const BASE_SEARCH_RESULT = `assetType
  id
  assetType
  mediaId
  title
  status
  score
  size
  password
  quality
  qualityGroup
  source
  modifier
  resolution
  repack
  postedTime
  createdTime
  tags {
    ${BASE_SEARCH_RESULT_TAG}
  }
  downloads {
    ${BASE_MEDIA_DOWNLOAD}
  }`;
