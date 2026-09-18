import {
  MediaAssetSearchType,
  MediaAssetWorkflowStatus,
  MediaAssetWorkflowStepStatus,
  MediaAssetWorkflowStepType,
  MediaAssetWorkflowSubStepType,
} from "@ncfritz/olympus-model";
import { GraphQlMediaAssetDownload } from "./mediaDownload";

export type GraphQlMediaAssetWorkflow = {
  id: string;
  type: MediaAssetSearchType;
  mediaId: number;
  tempLocation: string;
  status: MediaAssetWorkflowStatus;
  createdTime: string;
  lastUpdatedTime: string;
  startedTime: string;
  finishedTime: string;
  download: GraphQlMediaAssetDownload;
  // Transcode
  steps?: GraphQlMediaAssetWorkflowStep[];
};

export type GraphQlMediaAssetWorkflowGenericStep = {
  id: string;
  assetType: MediaAssetSearchType;
  mediaId: number;
  status: MediaAssetWorkflowStepStatus;
  progress: number;
  startedTime: string;
  finishedTime: string;
  createdTime: string;
  lastUpdatedTime: string;
};

export type GraphQlMediaAssetWorkflowSubStep =
  GraphQlMediaAssetWorkflowGenericStep & {
    type: MediaAssetWorkflowSubStepType;
  };

export type GraphQlMediaAssetWorkflowStep =
  GraphQlMediaAssetWorkflowGenericStep & {
    type: MediaAssetWorkflowStepType;
    subSteps?: GraphQlMediaAssetWorkflowSubStep[];
  };

export type GraphQlMediaAssetWorkflowDecoration = {
  name: string;
  title?: string;
  season?: number;
  episode?: number;
  seriesId?: number;
  posterPath?: string;
};

export type GraphQlDecoratedMediaAssetWorkflowStep =
  GraphQlMediaAssetWorkflowStep & {
    decoration: GraphQlMediaAssetWorkflowDecoration;
  };

export type GraphQlDecoratedMediaAssetWorkflow = GraphQlMediaAssetWorkflow & {
  decoration: GraphQlMediaAssetWorkflowDecoration;
};
