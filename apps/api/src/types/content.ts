import { ContentTagType } from "@ncfritz/olympus-model";

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
