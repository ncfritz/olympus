export const BASE_SEARCH_CONFIGURATION = `assetType
  backoff
  createdTime
  enabled
  episodeNumber
  jitter
  lastExecutionTime
  lastModifiedTime
  mediaId
  nextExecutionTime
  seasonNumber
  seriesId`;

export const SEARCH_CONFIGURATION = `searchConfiguration {
  ${BASE_SEARCH_CONFIGURATION}
}`;
