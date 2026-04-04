import {
  MediaAssetSearchType,
  PasswordType, SearchResultStatus,
  SearchResultTagType
} from "@ncfritz/olympus-model";
import { GraphQlMediaAssetDownload } from "./mediaDownload";

export type GraphQlMediaAssetSearchResult = {
  id: string;
  assetType: MediaAssetSearchType;
  mediaId: number;
  title: string;
  status: SearchResultStatus;
  score: number;
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
  tags: GraphQlMediaAssetSearchResultTag[];
  downloads: GraphQlMediaAssetDownload[];
};

export type GraphQlMediaAssetSearchResultTag = {
  type: SearchResultTagType;
  value: string;
  score: number;
  createdTime: string;
};
