import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";
import { MediaAssetWorkflowDecoration } from "./mediaWorkflow";
import { MediaAssetSearchType } from "./searchConfiguration";
import { SearchResultStatus } from "./searchResult";

export enum MediaDownloadStatus {
  PENDING = "pending",
  DOWNLOADING = "downloading",
  SUCCESS = "success",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export class MediaAssetDownload {
  @ApiProperty({
    type: String,
    required: true,
    description: "The GUID of the download.",
  })
  id: string;

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
      "The primary ID of the media asset associated with the download.  This should be the canonical ID of the " +
      "media source and should not include the season or episode IDs if requesting a TV Season or TV Episode.",
  })
  mediaId: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The ID of the download assigned by NZBGet.",
  })
  nzbId?: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "The ID of the workflow this download belongs to.",
  })
  workflowId?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the search result this download was created from.",
  })
  searchResultId: string;

  @ApiProperty({
    enum: () => MediaDownloadStatus,
    enumName: "MediaDownloadStatus",
    required: true,
    description: "The status of the download",
  })
  status: MediaDownloadStatus;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The progress percent of the download",
  })
  progress: number;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the download started",
  })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  startedTime?: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the download finished",
  })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  finishedTime?: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the download was created",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the download was last updated",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMediaAssetDownload extends PartialType(
  OmitType(MediaAssetDownload, [
    "createdTime",
    "lastUpdatedTime",
    "id",
    "workflowId",
  ]),
) {}

export class MediaAssetDownloadStatusUpdate {
  @ApiProperty({
    type: Number,
    required: false,
    description: "The Id of the download assigned by NZBGet.",
  })
  nzbId?: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The progress percent of the download",
  })
  progress: number;

  @ApiProperty({
    enum: () => MediaDownloadStatus,
    enumName: "MediaDownloadStatus",
    required: true,
    description: "The status of the download",
  })
  status: MediaDownloadStatus;
}

export class DecoratedMediaAssetDownload extends MediaAssetDownload {
  @ApiProperty({
    type: () => MediaAssetWorkflowDecoration,
    required: true,
    description: "Decoration details used for list items display",
  })
  decoration: MediaAssetWorkflowDecoration;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class UpdateMediaAssetDownloadRequest {
  @ApiProperty({
    type: () => PartialMediaAssetDownload,
    required: true,
    description: "The media asset download updates to make",
  })
  download: PartialMediaAssetDownload;
}

export class UpdateMediaAssetDownloadByNzbIdRequest {
  @ApiProperty({
    type: () => PartialMediaAssetDownload,
    required: true,
    description: "The media asset download updates to make",
  })
  download: PartialMediaAssetDownload;

  @ApiProperty({
    enum: () => SearchResultStatus,
    enumName: "SearchResultStatus",
    required: true,
    description: "The status of the download",
  })
  searchResultStatus: SearchResultStatus;
}

export class BulkUpdateMediaAssetDownloadStatusRequest {
  @ApiProperty({
    type: () => MediaAssetDownloadStatusUpdate,
    required: true,
    isArray: true,
    description: "The set of download status updates to make",
  })
  updates: MediaAssetDownloadStatusUpdate[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class SingleMediaAssetDownloadResponse {
  @ApiProperty({
    type: () => MediaAssetDownload,
    required: true,
    description: "A download that has been created, updated, or queried",
  })
  download: MediaAssetDownload;
}

export class BulkUpdateMediaAssetDownloadsResponse {
  @ApiProperty({
    type: () => MediaAssetDownload,
    isArray: true,
    required: true,
    description: "A download that has been created, updated, or queried",
  })
  updates: MediaAssetDownload[];
}

export class ListMediaAssetDownloadsResponse extends PaginatedResults {
  @ApiProperty({
    type: () => DecoratedMediaAssetDownload,
    isArray: true,
    required: true,
    description: "A download that has been created, updated, or queried",
  })
  downloads: DecoratedMediaAssetDownload[];
}
