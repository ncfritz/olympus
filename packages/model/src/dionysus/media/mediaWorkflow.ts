import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { MediaAssetDownload } from "./mediaDownload";
import { MediaAssetWorkflowStep } from "./mediaWorkflowStep";
import { MediaAssetSearchType } from "./searchConfiguration";

export enum MediaAssetWorkflowStatus {
  QUEUED = "queued",
  RUNNING = "running",
  PENDING_INPUT = "pending_input",
  SUCCESS = "success",
  FAILED = "failed",
}

export class MediaAssetWorkflowDecoration {
  @ApiProperty({
    type: String,
    required: true,
    description: "The name of the media",
  })
  name: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The name of the TV series associated with the media, if the media is a TV episode",
  })
  seriesName?: string;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The season of the TV series associated with the media, if the media is a TV episode",
  })
  seasonNumber?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The episode number of the media, if the media is a TV episode",
  })
  episodeNumber?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The ID of the TV series associated with the media, if the media is a TV series, season, or episode",
  })
  seriesId?: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "The path to the poster for the media",
  })
  posterPath?: string;
}

export class BaseMediaAssetWorkflow {
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
}

export class MediaAssetWorkflow extends BaseMediaAssetWorkflow {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the workflow",
  })
  id: string;

  @ApiProperty({
    enum: () => MediaAssetWorkflowStatus,
    enumName: "MediaAssetWorkflowStatus",
    required: true,
    description: "The status of the workflow",
  })
  status: MediaAssetWorkflowStatus;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the workflow was created.",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the workflow was last updated.",
  })
  lastUpdatedTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the workflow was started.",
  })
  startedTime?: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the workflow finished.",
  })
  finishedTime?: Moment;

  @ApiProperty({
    type: () => MediaAssetDownload,
    required: true,
    description:
      "The download that spawned the workflow.  The workflow will track the download's progress from" +
      "acquisition to transcode to final delivery to the media library",
  })
  download: MediaAssetDownload;

  @ApiProperty({
    type: MediaAssetWorkflowStep,
    required: true,
    isArray: true,
    description:
      "A list of the steps that have been performed, or are being performed, by the workflow",
  })
  steps: MediaAssetWorkflowStep[];
}

export class MediaAssetWorkflowListItem extends MediaAssetWorkflow {
  @ApiProperty({
    type: () => MediaAssetWorkflowDecoration,
    required: true,
    description: "Decoration details used for list items display",
  })
  decoration: MediaAssetWorkflowDecoration;
}

export class MutableMediaAssetWorkflow extends OmitType(MediaAssetWorkflow, [
  "id",
  "createdTime",
  "lastUpdatedTime",
  "download",
  "steps",
]) {}

export class PartialMediaAssetWorkflow extends PartialType(
  MutableMediaAssetWorkflow,
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class UpdateMediaAssetWorkflowRequest {
  @ApiProperty({
    required: true,
    type: () => PartialMediaAssetWorkflow,
    description:
      "A partial workflow representing the changes to make to an existing workflow",
  })
  workflow: PartialMediaAssetWorkflow;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class SingleMediaAssetWorkflowResponse {
  @ApiProperty({
    required: true,
    type: () => MediaAssetWorkflow,
    description: "The newly created workflow",
  })
  workflow: MediaAssetWorkflow;
}

export class ListMediaAssetWorkflowsResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => MediaAssetWorkflowListItem,
    isArray: true,
    description: "A list of workflows",
  })
  workflows: MediaAssetWorkflowListItem[];
}
