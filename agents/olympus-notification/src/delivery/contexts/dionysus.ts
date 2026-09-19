import type {
  DecoratedMediaAssetWorkflow,
  JobStatus,
  JobType,
  MediaAssetSearchType,
  MediaAssetWorkflowDecoration,
  Workflow,
  WorkflowStatus,
  WorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import type { Attachment } from "nodemailer/lib/mailer";

export interface AttachmentAwareMessageContext {
  attachments?: Attachment[];
}

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
  assetType: MediaAssetSearchType;
  mediaId: number;
  media: MediaAssetWorkflowDecoration;
}

export interface DionysusTranscodeWorkflowCompleteContext extends NotificationContext {
  workflowId: string;
}

export interface DionysusTranscodeWorkflowCompleteMessageContext extends AttachmentAwareMessageContext {
  workflow: DecoratedMediaAssetWorkflow;
}
