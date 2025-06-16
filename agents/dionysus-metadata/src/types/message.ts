import {
  JobStatus,
  JobType,
  MetadataFetchJobStatus,
} from "@ncfritz/olympus-model";
import { Moment } from "moment";

export type BatchJobMessage = {
  jobId: string;
  jobType: JobType;
  workflowId?: string;
  stepId?: string;
  bypassCache: boolean;
  offset: number;
  max?: number;
  attempt?: number;
};

export type RedriveJobMessage = BatchJobMessage & {
  status: JobStatus;
  targetStatus: MetadataFetchJobStatus;
  republish: boolean;
};

export type MetadataJobMessage = {
  entityId: string;
  entityType: JobType;
  bypassCache: boolean;
};

export type StartWorkflowMessage = {
  workflowId: string;
};

export type BatchJobWorkflowMessage = {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  workflowId?: string;
  stepId?: string;
  attempt: number;
  recordsProcessed: number;
};

export type TVSeasonContext = {
  lastEpisodeAirDate: Moment;
};
