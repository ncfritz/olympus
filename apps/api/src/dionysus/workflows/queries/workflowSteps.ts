import { BATCH_JOB } from "../../jobs/batch/queries/batchJobs";

export const BASE_METADATA_WORKFLOW_STEP = `id
  type
  attempt
  createdTime
  lastUpdatedTime`;

export const METADATA_WORKFLOW_STEP = `
  ${BASE_METADATA_WORKFLOW_STEP}
  job {
    ${BATCH_JOB}
  }`;
