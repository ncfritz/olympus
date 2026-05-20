import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";

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

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the workflow was created.",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the workflow was last updated.",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the workflow was started.",
  })
  @ApiProperty({ type: String })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  startedTime?: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the workflow finished.",
  })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
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

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateMediaAssetWorkflowStepRequest {
  @ApiProperty({
    type: () => BaseMediaAssetWorkflowStep,
    description: "The details of the workflow step to create",
  })
  step: BaseMediaAssetWorkflowStep;
}

export class CreateMediaAssetWorkflowSubStepRequest {
  @ApiProperty({
    type: () => BaseMediaAssetWorkflowSubStep,
    description: "The details of the workflow sub step to create",
  })
  step: BaseMediaAssetWorkflowSubStep;
}

export class UpdateMediaAssetWorkflowStepRequest {
  @ApiProperty({
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
  subtitleTrackIndex: number;

  @ApiProperty({
    type: Boolean,
    description:
      "Indicates if the transcode should produce verification artifacts and require manual approval",
    required: false,
    default: false,
  })
  verificationRequired: boolean;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateMediaAssetWorkflowStepResponse {
  @ApiProperty({
    type: () => MediaAssetWorkflowStep,
    description: "The newly created workflow step",
  })
  step: MediaAssetWorkflowStep;
}

export class CreateMediaAssetWorkflowSubStepResponse {
  @ApiProperty({
    type: () => MediaAssetWorkflowSubStep,
    description: "The newly created workflow step",
  })
  step: MediaAssetWorkflowSubStep;
}

export class DescribeMediaAssetWorkflowStepResponse {
  @ApiProperty({
    type: () => MediaAssetWorkflowStep,
    description: "The workflow step",
  })
  step: MediaAssetWorkflowStep;
}

export class UpdateMediaAssetWorkflowStepResponse {
  @ApiProperty({
    type: () => MediaAssetWorkflowStep,
    description: "The updated workflow step",
  })
  step: MediaAssetWorkflowStep;
}

export class ListMediaAssetWorkflowStepsResponse {
  @ApiProperty({
    type: () => MediaAssetWorkflowStep,
    isArray: true,
    description: "A list of workflow steps associated with the workflow",
  })
  steps: MediaAssetWorkflowStep[];
}
