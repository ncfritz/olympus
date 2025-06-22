import { NotificationContext } from "@ncfritz/olympus-model/dist/notifications";
import { JobStatus, JobType } from "@ncfritz/olympus-model";

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
