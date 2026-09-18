import { WorkflowStatus, WorkflowStepType } from "@ncfritz/olympus-model";
import { GraphQlBatchJob } from "./batchJobs";

export type GraphQLWorkflow = {
  id: string;
  createdTime: string;
  lastUpdatedTime: string;
  startedTime: string;
  finishedTime: string;
  status: WorkflowStatus;
  steps?: GraphQlWorkflowStep[];
  steps_aggregate?: {
    aggregate: {
      count: number;
    };
  };
};

export type GraphQlWorkflowStep = {
  id: string;
  createdTime: string;
  lastUpdatedTime: string;
  type: WorkflowStepType;
  attempt: number;
  job?: GraphQlBatchJob;
};
