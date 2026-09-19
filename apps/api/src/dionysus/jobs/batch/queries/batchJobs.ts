export const BASE_BATCH_JOB = `id
  type
  status
  createdTime
  lastUpdatedTime
  startedTime
  finishedTime
  totalRecords
  processedRecords
  duplicateRecords
  noOpRecords
  newRecords
  expiredRecords
  skippedRecords`;

export const BATCH_JOB = `
  ${BASE_BATCH_JOB}
  maxRecordsToProcess`;

export const BATCH_JOB_STATISTICS = `count
  created_date
  duplicate_records
  expired_records
  new_records
  noop_records
  processed_records
  queue_time
  run_time
  skipped_records
  total_records
  type`;
