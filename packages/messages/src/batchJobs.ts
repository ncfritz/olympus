import type {
  JobStatus,
  JobType,
  MetadataFetchJobStatus,
  MetadataJobType,
} from "./values";
import { delayedExchange, exchange, route } from "./routing";

/**
 * Batch metadata jobs. The API starts them (CreateBatchJob, CreateRedriveJob,
 * metadata workflow steps); the metadata agents run them and report
 * completion to their workflow.
 */

export const BATCH_JOB_TRIGGER_EXCHANGE = exchange("batchJob.trigger", "topic");
export const BATCH_JOB_WORKFLOW_EXCHANGE = delayedExchange(
  "batchJob.workflow",
  "direct",
);

/** Load a page of entities of `jobType`. */
export interface BatchJobMessage {
  jobId: string;
  jobType: MetadataJobType;
  /** Set when the job is a metadata workflow step. */
  workflowId?: string;
  stepId?: string;
  /** Re-fetch entities even if cached (default false). */
  bypassCache?: boolean;
  offset: number;
  max?: number;
  attempt?: number;
}

/** Re-queue metadata fetch jobs of `jobType` in `status`. */
export interface RedriveJobMessage extends BatchJobMessage {
  status: MetadataFetchJobStatus;
  targetStatus: MetadataFetchJobStatus;
  republish: boolean;
}

/** `jobType.<type>` → queue `batchJob.<type>.trigger` */
export const batchJobRoute = (jobType: MetadataJobType) =>
  route<BatchJobMessage>(BATCH_JOB_TRIGGER_EXCHANGE, `jobType.${jobType}`);

/** `jobType.redrive` → queue `batchJob.redrive.trigger` */
export const REDRIVE_JOB_ROUTE = route<RedriveJobMessage>(
  BATCH_JOB_TRIGGER_EXCHANGE,
  "jobType.redrive",
);

/** A metadata workflow was created; the agent starts its first step. */
export interface StartWorkflowMessage {
  workflowId: string;
}

/** `workflowCreated` → queue `metadataJob.workflow.trigger` */
export const START_WORKFLOW_ROUTE = route<StartWorkflowMessage>(
  BATCH_JOB_WORKFLOW_EXCHANGE,
  "workflowCreated",
);

/** A batch job finished; the workflow decides the next step. */
export interface BatchJobCompletionMessage {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  workflowId?: string;
  stepId?: string;
  attempt: number;
  recordsProcessed: number;
}

/** `jobCompletion` → queue `metadataJob.workflow.jobNotification` */
export const BATCH_JOB_COMPLETION_ROUTE = route<BatchJobCompletionMessage>(
  BATCH_JOB_WORKFLOW_EXCHANGE,
  "jobCompletion",
);
