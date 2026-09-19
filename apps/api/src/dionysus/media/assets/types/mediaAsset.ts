import { MediaAssetSearchType } from "@ncfritz/olympus-model";

export type GraphQlMediaAsset = {
  type: MediaAssetSearchType;
  mediaId: number;
  filePath: string;
  assetSha: string;
  originalSizeBytes: number;
  newSizeBytes: number;
  durationMs: number;
  width: number;
  height: number;
  createdTime: string;
  lastUpdatedTime: string;
};
