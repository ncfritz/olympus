import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PaginatedResults } from "../common";

export enum ContentTagType {
  SOURCE = "source",
  USER = "user",
  TYPE = "type",
  SYSTEM = "system",
  MODEL = "model",
}

export enum ContentJobType {
  HLS = "hls",
  THUMBNAIL = "thumbnail",
  DELETE = "delete",
}

export class CreateContentAssetRequest {
  @ApiProperty({
    type: () => BaseContentAsset,
  })
  asset: BaseContentAsset;
}

export class CreateContentAssetResponse {
  @ApiProperty({
    type: () => ContentAsset,
  })
  asset: ContentAsset;
}

export class ListContentAssetsResponse extends PaginatedResults {
  @ApiProperty({ type: () => ContentAsset, isArray: true })
  assets: ContentAsset[];
}

export class ListSimilarContentAssetsResponse {
  @ApiProperty({ type: () => ContentAsset, isArray: true })
  assets: ContentAsset[];
}

export class ListDuplicateContentAssetsResponse {
  @ApiProperty({ type: () => ContentAsset, isArray: true })
  assets: ContentAsset[];
}

export class SetContentAssetRatingRequest {
  @ApiProperty({ type: Number })
  rating: number;
}

export class ListAvailableContentAssetTagsResponse {
  @ApiProperty({ type: () => ContentAssetTag, isArray: true })
  tags: ContentAssetTag[];
}

export class ListContentAssetTagsForAssetResponse {
  @ApiProperty({ type: () => ContentAssetTag, isArray: true })
  tags: ContentAssetTag[];
}

export class AddContentAssetTagToAssetRequest {
  @ApiProperty({ type: () => BaseContentAssetTag })
  tag: BaseContentAssetTag;
}

export class GetContentAssetResponse {
  @ApiProperty({ type: () => ContentAsset })
  asset: ContentAsset;
}

export class GetContentAssetWithStatsResponse {
  @ApiProperty({ type: () => ContentAsset })
  asset: ContentAsset;

  @ApiProperty({ type: Number })
  tagged: number;

  @ApiProperty({ type: Number })
  untagged: number;
}

export class RemoveContentAssetTagFromAsset {
  @ApiProperty({ type: String })
  contentAssetTagId: string;
}

export class BaseContentAsset {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  originalName: string;

  @ApiProperty({ type: String })
  originalSha: string;

  @ApiProperty({ type: Number })
  originalSizeBytes: number;

  @ApiProperty({ type: String })
  newSha: string;

  @ApiProperty({ type: Number })
  newSizeBytes: number;

  @ApiProperty({ type: Number })
  durationMs: number;

  @ApiProperty({ type: Number })
  width: number;

  @ApiProperty({ type: Number })
  height: number;
}

export class ContentAsset extends BaseContentAsset {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: Number })
  rating?: number;

  @ApiProperty({ type: () => ContentAssetTag, isArray: true })
  tags: ContentAssetTag[];
}

export class BaseContentAssetTag {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ enum: () => ContentTagType, enumName: "ContentTagType" })
  type: ContentTagType;
}

export class ContentAssetTag extends BaseContentAssetTag {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;
}

export class ContentStatisticsSeries {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: () => Number, isArray: true })
  data: number[];
}

export class ContentStatisticsResponse {
  @ApiProperty({ type: () => String, isArray: true })
  categories: string[];

  @ApiProperty({ type: () => ContentStatisticsSeries, isArray: true })
  series: ContentStatisticsSeries[];
}

export class ContentAggregateStatisticsResponse {
  @ApiProperty({ type: Number })
  count: number;

  @ApiProperty({ type: Number })
  minSize: number;

  @ApiProperty({ type: Number })
  maxSize: number;

  @ApiProperty({ type: Number })
  avgSize: number;

  @ApiProperty({ type: Number })
  totalSize: number;

  @ApiProperty({ type: Number })
  minDuration: number;

  @ApiProperty({ type: Number })
  maxDuration: number;

  @ApiProperty({ type: Number })
  avgDuration: number;

  @ApiProperty({ type: Number })
  totalDuration: number;
}

export class CreateContentJobRequest {
  @ApiProperty({
    enum: () => ContentJobType,
    enumName: "ContentJobType",
    description: "The type of content job to create",
    required: true,
  })
  type: ContentJobType;
}

export class CreateContentAssetTagRequest {
  @ApiProperty({ type: () => BaseContentAssetTag })
  tag: BaseContentAssetTag;
}

export class CreateContentAssetTagResponse {
  @ApiProperty({ type: () => ContentAssetTag })
  tag: ContentAssetTag;
}

export class CheckAuthResponse {
  @ApiProperty({ type: Boolean, required: true })
  authorized: boolean;
}

export class VerifyAuthResponse {
  @ApiProperty({ type: Boolean, required: true })
  authorized: boolean;
}
