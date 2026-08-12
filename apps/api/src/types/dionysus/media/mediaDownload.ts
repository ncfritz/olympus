import {
  MediaAssetSearchType,
  MediaDownloadStatus,
} from "@ncfritz/olympus-model";
import type { GraphQlMediaAssetWorkflowDecoration } from "./mediaAssetWorkflow";

export type GraphQlMediaAssetDownload = {
  id: string;
  nzbId?: number;
  assetType: MediaAssetSearchType;
  mediaId: number;
  workflowId: string;
  searchResultId: string;
  status: MediaDownloadStatus;
  progress: number;
  startedTime: string;
  finishedTime: string;
  createdTime: string;
  lastUpdatedTime: string;
};

export type GraphQlDecoratedMediaAssetDownload = GraphQlMediaAssetDownload & {
  decoration: GraphQlMediaAssetWorkflowDecoration;
};
