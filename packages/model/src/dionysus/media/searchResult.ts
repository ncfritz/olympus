import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { MediaAssetDownload } from "./mediaDownload";
import { MediaAssetSearchType } from "./searchConfiguration";

export enum PasswordType {
  NONE = 0,
  RAR_PASS = 1,
  INNER_ARCHIVE = 2,
}

export enum SearchResultStatus {
  NONE = "none",
  DOWNLOAD_REQUESTED = "download_requested",
  DOWNLOADING = "downloading",
  DOWNLOADED = "downloaded",
  DOWNLOAD_FAILED = "download_failed",
  BLOCKED = "blocked",
}

export enum SearchResultTagType {
  AUDIO_CHANNEL = "audioChannel",
  AUDIO_FORMAT = "audioFormat",
  HDR = "hdr",
  MOVIE_VERSION = "movieVersion",
  UNWANTED = "unwanted",
  STREAMING_SERVICES = "streamingServices",
  RELEASE_GROUPS = "releaseGroups",
  MISC = "misc",
  RESOLUTION = "resolution",
  VIDEO_CODEC = "videoCodec",
}

export class BaseSearchResultTag {
  @ApiProperty({
    enum: () => SearchResultTagType,
    enumName: "SearchResultTagType",
    required: true,
    description: "The type of the tag",
  })
  type: SearchResultTagType;

  @ApiProperty({
    type: String,
    required: true,
    description: "The tag value",
  })
  value: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The score of the tag",
  })
  score: number;
}

export class SearchResultTag extends BaseSearchResultTag {
  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search result tag was created",
  })
  createdTime: Moment;
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
    enum: () => SearchResultStatus,
    enumName: "SearchResultStatus",
    enumSchema: { description: "The status of a media asset search result" },
    required: true,
    description: "The status of the search result",
  })
  status: SearchResultStatus;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The overall score of the search result.",
  })
  score: number;

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
    description: "The resolution of the result.",
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

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search result was posted to Usenet",
  })
  postedTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search result was created",
  })
  createdTime: Moment;
}

export class MediaAssetSearchResult extends BaseMediaAssetSearchResult {
  @ApiProperty({
    type: () => MediaAssetDownload,
    required: true,
    isArray: true,
    description: "The set of downloads associated with the search result",
  })
  downloads: MediaAssetDownload[];

  @ApiProperty({
    type: () => SearchResultTag,
    required: true,
    isArray: true,
    description: "The tags associated with the search result",
  })
  tags: SearchResultTag[];
}

export class PartialMediaAssetSearchResult extends OmitType(
  MediaAssetSearchResult,
  ["createdTime", "tags", "downloads"],
) {
  @ApiProperty({
    enum: () => MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
    enumSchema: { description: "The type of media asset" },
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

  @ApiProperty({
    type: () => BaseSearchResultTag,
    required: false,
    isArray: true,
    description: "The tags associated with the search result",
  })
  tags?: BaseSearchResultTag[];
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

export class UpdateMediaAssetSearchResultStatusRequest {
  @ApiProperty({
    type: () => SearchResultStatus,
    enumName: "SearchResultStatus",
    enumSchema: { description: "The status of a media asset search result" },
    required: true,
    description: "The status to set the search result to",
  })
  searchResult: SearchResultStatus;
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
