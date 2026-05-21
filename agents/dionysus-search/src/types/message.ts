import { MediaAssetSearchType } from "@ncfritz/olympus-sdk/dionysus";

export type SearchFanoutMessage = {
  maxEntriesToProcess: number;
};

export type SearchExecutionMessage = {
  mediaId: number;
  propagateImmediately?: boolean;
  initiatingAsset?: {
    assetType: MediaAssetSearchType;
    mediaId: number;
    seriesId: number;
    seasonNumber: number;
  };
};

export type StartDownloadMessage = {
  mediaType: MediaAssetSearchType;
  mediaId: number;
  resultId: string;
  workflowId: string;
  downloadId: string;
  nzbId: string;
};
