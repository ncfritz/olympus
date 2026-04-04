import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { MediaAssetSearchType } from "./searchConfiguration";

export class BaseMediaAsset {
  @ApiProperty({
    enum: () => MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
    required: true,
    description: "The type of media asset",
  })
  type: MediaAssetSearchType;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The primary ID of the media asset search configuration.  This should be the canonical ID of the media source" +
      "and should not include the season or episode IDs if requesting a TV Season or TV Episode.",
  })
  mediaId: number;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The path to the asset - i.e. the full path to the asset in the library",
  })
  filePath: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The SHA-256 hash of the transcoded asset",
  })
  assetSha: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The size of the original, non-transcoded file, in bytes",
  })
  originalSizeBytes: number;

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

export class MediaAsset extends BaseMediaAsset {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the asset was created",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the asset was last updated",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateMediaAssetRequest {
  @ApiProperty({
    type: () => BaseMediaAsset,
    required: true,
    description: "The media asset to create",
  })
  asset: BaseMediaAsset;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class SingleMediaAssetResponse {
  @ApiProperty({
    type: () => MediaAsset,
    required: true,
    description: "A media asset that has been created, updated, or queried",
  })
  asset: MediaAsset;
}
