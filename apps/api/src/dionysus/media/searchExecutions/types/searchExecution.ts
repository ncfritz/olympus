import {
  MediaAssetSearchType,
  SearchExecutionStatus,
} from "@ncfritz/olympus-model";

export type GraphQlMediaAssetSearchExecution = {
  id: string;
  status: SearchExecutionStatus;
  searchType: MediaAssetSearchType;
  mediaId: number;
  newRecords: number;
  duplicateRecords: number;
  skippedRecords: number;
  totalRecords: number;
  startedTime: string;
  finishedTime?: string;
  createdTime: string;
  lastUpdatedTime: string;
};
