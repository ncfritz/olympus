import {
  ContentIngestionWorkflowAssetLocation,
  ContentIngestionWorkflowStatus,
  ContentIngestionWorkflowStepStatus,
  ContentIngestionWorkflowStepType,
} from "@ncfritz/olympus-model";

export type GraphQLContentIngestionWorkflow = {
  id: string;
  source: string;
  sourceType: ContentIngestionWorkflowAssetLocation;
  tempLocation: string;
  status: ContentIngestionWorkflowStatus;
  createdTime: string;
  lastUpdatedTime: string;
  startedTime: string;
  finishedTime: string;
  steps?: GraphQlContentIngestionWorkflowStep[];
  steps_aggregate?: {
    aggregate: {
      count: number;
    };
  };
};

export type GraphQlContentIngestionWorkflowStep = {
  id: string;
  type: ContentIngestionWorkflowStepType;
  status: ContentIngestionWorkflowStepStatus;
  progress: number;
  startedTime: string;
  finishedTime: string;
  createdTime: string;
  lastUpdatedTime: string;
};
