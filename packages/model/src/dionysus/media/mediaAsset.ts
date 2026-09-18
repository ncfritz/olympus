import { ApiTimestamp } from "../../decorators";
import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
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
  newSizeBytes: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The duration of the asset, in milliseconds",
  })
  durationMs: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "TThe pixel width of the asset",
  })
  width: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "TThe pixel height of the asset",
  })
  height: number;
}

export class MediaAsset extends BaseMediaAsset {
  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the asset was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the asset was last updated",
  })
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
