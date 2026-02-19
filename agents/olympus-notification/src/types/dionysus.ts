import {
  JobStatus,
  JobType,
  Workflow,
  WorkflowStatus,
  WorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import { NotificationContext } from "@ncfritz/olympus-sdk/olympus";

export interface DionysusBatchJobContext extends NotificationContext {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  recordCounts: {
    total: number;
    processed: number;
    duplicate: number;
    new: number;
    expired: number;
    noop: number;
    skipped: number;
  };
}

export interface DionysusWorkflowContext extends NotificationContext {
  workflowId: string;
  status: WorkflowStatus;
}

export interface DionysusWorkflowMessageContext {
  workflow: Workflow;
  steps: WorkflowStep[];
}

export interface DionysusMediaAssetSearchRefreshCompleteContext extends NotificationContext {
}
