import { MediaAssetSearchType, PasswordType } from "@ncfritz/olympus-model";

export type GraphQlMediaAssetSearchResult = {
  id: string;
  assetType: MediaAssetSearchType;
  mediaId: number;
  title: string;
  size: number;
  password: PasswordType;
  quality: string;
  qualityGroup: string;
  source: number;
  modifier: number;
  resolution: number;
  repack: boolean;
  postedTime: string;
  createdTime: string;
};
