import { MetadataFetchJobStatus } from "@ncfritz/olympus-sdk/dionysus";

export const BATCH_JOB_PREFIX = "batchJob";
export const METADATA_JOB_PREFIX = "metadataJob";
export const JOB_TYPE_PREFIX = "jobType";
export const TRIGGER_SUFFIX = "trigger";
export const WORKFLOW_SUFFIX = "workflow";

export const BATCH_JOB_TRIGGER_EXCHANGE = `${BATCH_JOB_PREFIX}.${TRIGGER_SUFFIX}`;
export const BATCH_JOB_WORKFLOW_EXCHANGE = `${BATCH_JOB_PREFIX}.${WORKFLOW_SUFFIX}`;
export const METADATA_JOB_TRIGGER_EXCHANGE = `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`;

export const TERMINAL_STATUSES: MetadataFetchJobStatus[] = [
  "failed",
  "invalidated",
  "fetched",
  "cancelled",
];
