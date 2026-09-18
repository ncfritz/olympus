import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { MediaAssetWorkflowDecoration } from "./mediaWorkflow";
import { MediaAssetSearchType } from "./searchConfiguration";

export enum MediaAssetWorkflowStepType {
  EXTRACT_ORIGINAL_METADATA = "extract_original_metadata",
  CONFIGURE_TRANSCODE = "configure_transcode",
  VERIFY_TRANSCODE = "verify_transcode",
  EXTRACT_NEW_METADATA = "extract_new_metadata",
  TRANSCODE = "transcode",
  UPLOAD = "upload",
  CLEANUP = "cleanup",
}

export enum MediaAssetWorkflowSubStepType {
  TRANSFER_SOURCE = "transfer_source",
  UPLOAD_ARTIFACTS = "upload_artifacts",
  CLEANUP = "cleanup",
  // Verify
  EXTRACT_SRT = "extract_srt",
  SAMPLE_0 = "sample_0",
  SAMPLE_1 = "sample_1",
  SAMPLE_2 = "sample_2",
  SAMPLE_3 = "sample_3",
  SAMPLE_4 = "sample_4",
  SAMPLE_5 = "sample_5",
  // Transcode
  ADD_TO_LIBRARY = "add_to_library",
  UPDATE_SEARCH_CONFIGURATION = "update_search_configuration",
}

export enum MediaAssetWorkflowStepStatus {
  RUNNING = "running",
  PENDING = "pending",
  SUCCESS = "success",
  SKIPPED = "skipped",
  FAILED = "failed",
}

class InternalBaseMediaAssetWorkflowStep {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique identified for the workflow step",
  })
  id: string;

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
      "The primary ID of the media asset associated with the download.  This should be the canonical ID of the " +
      "media source and should not include the season or episode IDs if requesting a TV Season or TV Episode.",
  })
  mediaId: number;

  @ApiProperty({
    enum: () => MediaAssetWorkflowStepStatus,
    enumName: "MediaAssetWorkflowStepStatus",
    required: true,
    description: "The status of the workflow step",
  })
  status: MediaAssetWorkflowStepStatus;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "TThe amount of progress that has been made in the execution of the workflow step",
  })
  progress: number;

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
}

export class BaseMediaAssetWorkflowSubStep {
  @ApiProperty({
    enum: () => MediaAssetWorkflowSubStepType,
    enumName: "MediaAssetWorkflowSubStepType",
    required: true,
    description: "The type of sub step the workflow step is performing",
  })
  type: MediaAssetWorkflowSubStepType;
}

export class MediaAssetWorkflowSubStep extends InternalBaseMediaAssetWorkflowStep {
  @ApiProperty({
    enum: () => MediaAssetWorkflowSubStepType,
    enumName: "MediaAssetWorkflowSubStepType",
    required: true,
    description: "The type of job the workflow sub step is performing",
  })
  type: MediaAssetWorkflowSubStepType;
}

export class BaseMediaAssetWorkflowStep {
  @ApiProperty({
    enum: () => MediaAssetWorkflowStepType,
    enumName: "MediaAssetWorkflowStepType",
    required: true,
    description: "The type of job the workflow step is performing",
  })
  type: MediaAssetWorkflowStepType;
}

export class MediaAssetWorkflowStep extends InternalBaseMediaAssetWorkflowStep {
  @ApiProperty({
    enum: () => MediaAssetWorkflowStepType,
    enumName: "MediaAssetWorkflowStepType",
    required: true,
    description: "The type of job the workflow step is performing",
  })
  type: MediaAssetWorkflowStepType;

  @ApiProperty({
    type: () => MediaAssetWorkflowSubStep,
    required: true,
    isArray: true,
    description:
      "TThe amount of progress that has been made in the execution of the workflow step",
  })
  subSteps: MediaAssetWorkflowSubStep[];
}

export class MutableMediaAssetWorkflowStep extends OmitType(
  MediaAssetWorkflowStep,
  ["id", "type", "createdTime", "lastUpdatedTime", "subSteps"],
) {}

export class PartialMediaAssetWorkflowStep extends PartialType(
  MutableMediaAssetWorkflowStep,
) {}

export class DecoratedMediaAssetWorkflowStep extends MediaAssetWorkflowStep {
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
export class CreateMediaAssetWorkflowStepRequest {
  @ApiProperty({
    required: true,
    type: () => BaseMediaAssetWorkflowStep,
    description: "The details of the workflow step to create",
  })
  step: BaseMediaAssetWorkflowStep;
}

export class CreateMediaAssetWorkflowSubStepRequest {
  @ApiProperty({
    required: true,
    type: () => BaseMediaAssetWorkflowSubStep,
    description: "The details of the workflow sub step to create",
  })
  step: BaseMediaAssetWorkflowSubStep;
}

export class UpdateMediaAssetWorkflowStepRequest {
  @ApiProperty({
    required: true,
    type: () => PartialMediaAssetWorkflowStep,
    description: "The details of the workflow step to update",
  })
  step: PartialMediaAssetWorkflowStep;
}

export class ApproveMediaAssetTranscodeConfigurationRequest {
  @ApiProperty({
    type: String,
    description:
      "The file extension of the original asset.  This is needed to ensure the appropriate filename is constructed " +
      "during the fetch phase.",
    required: true,
  })
  originalAssetExtension: string;

  @ApiProperty({
    type: Number,
    description: "The index of the video track to use for transcoding",
    required: true,
  })
  videoTrackIndex: number;

  @ApiProperty({
    type: Number,
    description: "The index of the audio track to use for transcoding",
    required: true,
  })
  audioTrackIndex: number;

  @ApiProperty({
    type: Number,
    description: "The index of the subtitle track to use for transcoding",
    required: false,
  })
  subtitleTrackIndex?: number;

  @ApiProperty({
    type: Boolean,
    description:
      "Indicates if the transcode should produce verification artifacts and require manual approval",
    required: false,
    default: false,
  })
  verificationRequired?: boolean;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateMediaAssetWorkflowStepResponse {
  @ApiProperty({
    required: true,
    type: () => MediaAssetWorkflowStep,
    description: "The newly created workflow step",
  })
  step: DecoratedMediaAssetWorkflowStep;
}

export class CreateMediaAssetWorkflowSubStepResponse {
  @ApiProperty({
    required: true,
    type: () => MediaAssetWorkflowSubStep,
    description: "The newly created workflow step",
  })
  step: MediaAssetWorkflowSubStep;
}

export class DescribeMediaAssetWorkflowStepResponse {
  @ApiProperty({
    required: true,
    type: () => MediaAssetWorkflowStep,
    description: "The workflow step",
  })
  step: DecoratedMediaAssetWorkflowStep;
}

export class UpdateMediaAssetWorkflowStepResponse {
  @ApiProperty({
    required: true,
    type: () => MediaAssetWorkflowStep,
    description: "The updated workflow step",
  })
  step: DecoratedMediaAssetWorkflowStep;
}

export class ListMediaAssetWorkflowStepsResponse {
  @ApiProperty({
    required: true,
    type: () => MediaAssetWorkflowStep,
    isArray: true,
    description: "A list of workflow steps associated with the workflow",
  })
  steps: MediaAssetWorkflowStep[];
}

export class ListMediaAssetTranscodesResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => DecoratedMediaAssetWorkflowStep,
    isArray: true,
    description: "A list of workflow steps associated with a transcode task",
  })
  steps: DecoratedMediaAssetWorkflowStep[];
}
