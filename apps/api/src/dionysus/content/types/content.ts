import { ContentTagType } from "@ncfritz/olympus-model";
import { Timestamped } from "../../metadata/types/metadata";

export type GraphQlBaseContentAssetTag = {
  name: string;
  type: ContentTagType;
};

export type GraphQlContentAssetTag = GraphQlBaseContentAssetTag & {
  content_tag_id: string;
  createdTime: string;
};

export type GraphQlContentAssetTagWrapper = {
  tag: GraphQlContentAssetTag;
};

export type GraphQLBaseContentAsset = {
  content_id: string;
  asset_sha: string;
  asset_size: number;
  duration: number;
  height: number;
  original_name: string;
  original_sha: string;
  original_size: number;
  width: number;
};

export type GraphQLContentAsset = GraphQLBaseContentAsset & {
  createdTime: string;
  name: string;
  rating: number;
  asset_tags: GraphQlContentAssetTagWrapper[];
};

export type GraphQLContentAssetBucketStatistic = {
  bucket: number;
  bucket_width: number;
  count: number;
};

export type GraphQlContentAssetChannelCategory = Timestamped & {
  id: string;
  name: string;
  channels_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

export type GraphQlFullContentAssetChannelCategory =
  GraphQlContentAssetChannelCategory & {
    channels: GraphQlContentAssetChannel[];
  };

export type GraphQlContentAssetChannelCacheEntry = {
  assetId: string;
  width: number;
  height: number;
  lastFetchedTime: string;
};

export type GraphQlContentAssetChannel = Timestamped & {
  id: string;
  name: string;
  description: string;
  filterInput: string;
  encodedFilter: string;
  ttl: number;
  jitter: number;
  favorite: boolean;
  bcCompliant: boolean;
  lastFetchedTime: string;
  assetCount: number;
  assetCache: GraphQlContentAssetChannelCacheEntry[];
};

export type GraphQlFullContentAssetChannel = GraphQlContentAssetChannel & {
  category: GraphQlContentAssetChannelCategory;
};
