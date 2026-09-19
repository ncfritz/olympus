export const BASE_METADATA_FETCH_JOB = `id
  type
  status
  createdTime
  lastUpdatedTime
  lastFetchedTime
  ttl
  jitter`;

export const METADATA_FETCH_JOB = `
  ${BASE_METADATA_FETCH_JOB}
  context`;
