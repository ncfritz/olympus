import {
  MediaAssetSearchConfigurationStatus,
  MediaAssetSearchType,
} from "@ncfritz/olympus-model";
import type { GraphQlMediaAssetWorkflowDecoration } from "./mediaAssetWorkflow";

export type GraphQlMediaAssetSearchConfiguration = {
  assetType: MediaAssetSearchType;
  mediaId: number;
  seriesId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  enabled: boolean;
  status: MediaAssetSearchConfigurationStatus;
  backoff: number;
  jitter: number;
  lastExecutionTime: string;
  nextExecutionTime: string;
  createdTime: string;
  lastUpdatedTime: string;
};

export type GraphQlDecoratedMediaAssetSearchConfiguration =
  GraphQlMediaAssetSearchConfiguration & {
    decoration: GraphQlMediaAssetWorkflowDecoration;
  };
