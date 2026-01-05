import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { ContentAssetTag } from "./tags";

export enum ContentJobType {
  HLS = "hls",
  THUMBNAIL = "thumbnail",
  DELETE = "delete",
}

export class BaseContentAsset {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the content asset",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The original filename - i.e. the name of asset from the source",
  })
  originalName: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The SHA-256 hash of the original, non-transcoded asset",
  })
  originalSha: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The size of the original, non-transcoded file, in bytes",
  })
  originalSizeBytes: number;

  @ApiProperty({
    type: String,
    required: true,
    description: "The SHA-256 hash of the transcoded asset",
  })
  @ApiProperty({ type: String })
  newSha: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The size of the transcoded file, in bytes",
  })
  @ApiProperty({ type: Number })
  newSizeBytes: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The duration of the asset, in milliseconds",
  })
  @ApiProperty({ type: Number })
  durationMs: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "TThe pixel width of the asset",
  })
  @ApiProperty({ type: Number })
  width: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "TThe pixel height of the asset",
  })
  @ApiProperty({ type: Number })
  height: number;
}

export class ContentAsset extends BaseContentAsset {
  @ApiProperty({
    type: String,
    required: false,
    description: "A user-supplied name for the asset",
  })
  name?: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the asset was created",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The user 'star' rating for the asset. This field has a range of 0-5 and should be specified in " +
      "increments of 0.5",
  })
  rating?: number;

  @ApiProperty({
    type: () => ContentAssetTag,
    isArray: true,
    required: true,
    description: "A set of tags associated with the asset",
  })
  tags: ContentAssetTag[];
}

export class ContentStatisticsSeries {
  @ApiProperty({
    type: String,
    required: true,
    description: "The name of the series",
  })
  name: string;

  @ApiProperty({
    type: () => Number,
    isArray: true,
    required: true,
    description: "The data for the series",
  })
  data: number[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateContentAssetRequest {
  @ApiProperty({
    type: () => BaseContentAsset,
    required: true,
    description: "The content asset to create",
  })
  asset: BaseContentAsset;
}

export class CreateContentJobRequest {
  @ApiProperty({
    enum: () => ContentJobType,
    enumName: "ContentJobType",
    required: true,
    description: "The content job to create",
  })
  type: ContentJobType;
}

export class SetContentAssetRatingRequest {
  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The user 'star' rating to set for the asset. This field has a range of 0-5 and should be specified in " +
      "increments of 0.5",
  })
  rating: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateContentAssetResponse {
  @ApiProperty({
    type: () => ContentAsset,
    required: true,
    description:
      "The created content asset. This asset will be stamped with an identifier generated during creation, " +
      "which can be used for future operations such as describe/update.",
  })
  asset: ContentAsset;
}

export class GetContentAssetResponse {
  @ApiProperty({
    type: () => ContentAsset,
    required: true,
    description: "The fetched content asset",
  })
  asset: ContentAsset;
}

export class GetContentAssetWithStatsResponse {
  @ApiProperty({
    type: () => ContentAsset,
    required: true,
    description: "The fetched content asset",
  })
  asset: ContentAsset;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of tagged assets in the system",
  })
  tagged: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of untagged assets in the system",
  })
  untagged: number;
}

export class ListContentAssetsResponse extends PaginatedResults {
  @ApiProperty({
    type: () => ContentAsset,
    isArray: true,
    required: true,
    description:
      "The list of content assets matching any supplied filters/pagination parameters",
  })
  assets: ContentAsset[];
}

export class ListSimilarContentAssetsResponse {
  @ApiProperty({
    type: () => ContentAsset,
    isArray: true,
    required: true,
    description: "The list of content assets similar to the input asset",
  })
  assets: ContentAsset[];
}

export class ListDuplicateContentAssetsResponse {
  @ApiProperty({
    type: () => ContentAsset,
    isArray: true,
    required: true,
    description: "The list of duplicate content assdets",
  })
  assets: ContentAsset[];
}

/* Statistic API responses */
export class ContentStatisticsResponse {
  @ApiProperty({
    type: () => String,
    isArray: true,
    required: true,
    description:
      "The categories to associate with the series data.  The index of the category MUST match with the index " +
      "of the series for proper interpretation of the data",
  })
  categories: string[];

  @ApiProperty({
    type: () => ContentStatisticsSeries,
    isArray: true,
    required: true,
    description: "The series definitions associated with the categories",
  })
  series: ContentStatisticsSeries[];
}

export class ContentAggregateStatisticsResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "The total number of assets in the system",
  })
  count: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The size of the smallest asset, in bytes",
  })
  minSize: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The size of the largest asset, in bytes",
  })
  maxSize: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The average size of an asset in the system, in bytes",
  })
  avgSize: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The total size, in bytes, of all assets",
  })
  totalSize: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The shortest duration of an asset, in milliseconds",
  })
  minDuration: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The longest duration of an asset, in milliseconds",
  })
  maxDuration: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The average duration of an asset in the system, in milliseconds",
  })
  avgDuration: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The total duration of all assets, in milliseconds",
  })
  totalDuration: number;
}
