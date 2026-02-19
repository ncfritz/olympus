import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { MediaAssetSearchType } from "./searchConfiguration";

export enum PasswordType {
  NONE = 0,
  RAR_PASS = 1,
  INNER_ARCHIVE = 2,
}

export class BaseMediaAssetSearchResult {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The GUID of the search result.  This should be a pure GUID and not one encoded as a URL.",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The title of the search result.",
  })
  title: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The size of the file the search result identifies.",
  })
  size: number;

  @ApiProperty({
    enum: () => PasswordType,
    enumName: "PasswordType",
    required: true,
    description: "What type of password protection is present on the archive",
  })
  password: PasswordType;

  @ApiProperty({
    type: String,
    required: true,
    description: "The quality group the result belongs to.",
  })
  qualityGroup: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The quality of the result.",
  })
  quality: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The resolution of the resuhlt.",
  })
  resolution: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The source of the result.",
  })
  source: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The modifier, if any, associated with the result.",
  })
  modifier: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the result is a repack.",
  })
  repack: boolean;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search result was posted to Usenet",
  })
  @Transform(({ value }) => value.toISOString())
  postedTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search result was created",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;
}

export class MediaAssetSearchResult extends BaseMediaAssetSearchResult {}

export class PartialMediaAssetSearchResult extends OmitType(
  MediaAssetSearchResult,
  ["createdTime"],
) {
  @ApiProperty({
    enum: () => MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
    required: true,
    description: "The type of media asset",
  })
  assetType: MediaAssetSearchType;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The primary ID of the media asset search configuration.  This should be the canonical ID of the media source" +
      "and should not include the season or episode IDs if requesting a TV Season or TV Episode.",
  })
  mediaId: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateMediaAssetSearchResultRequest {
  @ApiProperty({
    type: () => PartialMediaAssetSearchResult,
    required: true,
    description: "The media asset search result to create",
  })
  searchResult: PartialMediaAssetSearchResult;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class SingleMediaAssetSearchResultResponse {
  @ApiProperty({
    type: () => MediaAssetSearchResult,
    required: true,
    description: "A search result that has been created, updated, or queried",
  })
  searchResult: MediaAssetSearchResult;
}

export class ListMediaAssetSearchResultsResponse extends PaginatedResults {
  @ApiProperty({
    type: () => MediaAssetSearchResult,
    isArray: true,
    required: true,
    description: "A list of search results",
  })
  searchResults: MediaAssetSearchResult[];
}
