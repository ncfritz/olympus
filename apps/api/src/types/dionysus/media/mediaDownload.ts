import { MediaDownloadStatus } from "@ncfritz/olympus-model";

export type GraphQlMediaAssetDownload = {
  id: string;
  nzbId?: number;
  workflowId: string;
  status: MediaDownloadStatus;
  progress: number;
  startedTime: string;
  finishedTime: string;
  createdTime: string;
  lastUpdatedTime: string;
};
