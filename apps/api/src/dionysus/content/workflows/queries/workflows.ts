export const CONTENT_INGESTION_WORKFLOW_STEP = `id
  type
  status
  progress
  startedTime
  finishedTime
  createdTime
  lastUpdatedTime`;

export const BASE_CONTENT_INGESTION_WORKFLOW = `id
  source
  sourceType
  status
  startedTime
  finishedTime
  createdTime
  lastUpdatedTime`;

export const CONTENT_INGESTION_WORKFLOW_STEP_COUNT = `steps_aggregate {
    aggregate {
      count
    }
  }`;

export const CONTENT_INGESTION_WORKFLOW_SUMMARY = `
  ${BASE_CONTENT_INGESTION_WORKFLOW}
  ${CONTENT_INGESTION_WORKFLOW_STEP_COUNT}`;

export const CONTENT_INGESTION_WORKFLOW_WITH_STEPS = `
  ${BASE_CONTENT_INGESTION_WORKFLOW}
  steps {
    ${CONTENT_INGESTION_WORKFLOW_STEP}
  }`;
