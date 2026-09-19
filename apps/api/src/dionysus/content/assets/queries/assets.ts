import { BASE_CONTENT_TAG, CONTENT_TAG } from "../../queries/tags";

export const BASE_CONTENT_ASSET = `content_id
  asset_sha
  asset_size
  createdTime
  duration
  height
  name
  original_name
  original_sha
  original_size
  rating
  width`;

export const CONTENT_ASSET_TAGS = `asset_tags {
    tag {
      ${CONTENT_TAG}
    }
  }`;

export const CONTENT_ASSET_TAG_SUMMARIES = `asset_tags {
    tag {
      ${BASE_CONTENT_TAG}
    }
  }`;

export const CONTENT_ASSET = `
  ${BASE_CONTENT_ASSET}
  ${CONTENT_ASSET_TAGS}`;

export const CONTENT_ASSET_WITH_TAG_SUMMARIES = `
  ${BASE_CONTENT_ASSET}
  ${CONTENT_ASSET_TAG_SUMMARIES}`;

export const CONTENT_ASSET_HISTOGRAM_BUCKET = `bucket
  bucket_width
  count`;
