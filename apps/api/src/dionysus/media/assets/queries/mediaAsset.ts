export const BASE_MEDIA_ASSET = `assetType
  mediaId
  filePath
  assetSha
  originalSize
  newSize
  duration
  width
  height
  createdTime
  lastUpdatedTime`;

export const MEDIA_ASSET = `asset {
  ${BASE_MEDIA_ASSET}
}`;
