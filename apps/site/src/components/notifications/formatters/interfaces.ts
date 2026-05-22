import type {
  MediaAssetSearchType,
  WorkflowStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import type { ReactNode } from "react";
import { type JobStatus, type JobType } from "@ncfritz/olympus-sdk/dionysus";

export type NotificationPayload = {
  title: string;
  message: string;
};

export type DionysiusBatchJobPayload = {
  jobId: string;
  jobType: JobType;
  recordCounts: {
    duplicate: number;
    expired: number;
    new: number;
    noop: number;
    processed: number;
    skipped: number;
    total: number;
  };
  status: JobStatus;
};

export type DionysusWorkflowPayload = {
  workflowId: string;
  status: WorkflowStatus;
};

export type DionysusMediaAssetSearchPayload = {
  assetType: MediaAssetSearchType;
  mediaId: number;
};

export type NotificationEvent<T> = {
  closable: boolean;
  deleteOnClose: boolean;
  durable: boolean;
  eventId: string;
  messageType: string;
  notificationId: string;
  payload: {
    type: "plain" | "context";
    value: T;
  };
  type: string;
  visibleDuration: number;
  // Optional for in-app messages
  message?: string;
  description?: string;
};

export class NotificationFormatter<T> {
  format: (payload: T) => [string | ReactNode, string | ReactNode];
}
