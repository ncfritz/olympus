import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";

export enum ContentIngestionWorkflowStepType {
  DOWNLOAD = "download",
  CALCULATE_INPUT_SHA = "calculate_input_sha",
  CALCULATE_OUTPUT_SHA = "calculate_output_sha",
  EXTRACT_ORIGINAL_METADATA = "extract_original_metadata",
  TRANSCODE = "transcode",
  EXTRACT_NEW_METADATA = "extract_new_metadata",
  GENERATE_THUMBNAILS = "generate_thumbnails",
  GENERATE_SCREENSHOTS = "generate_screenshots",
  GENERATE_TIME_LAPSE = "generate_time_lapse",
  GENERATE_SAMPLE_VIDEO = "generate_sample_video",
  GENERATE_VIDEO_THUMBNAILS = "generate_video_thumbnails",
  GENERATE_HLS = "generate_hls",
  UPLOAD = "upload",
  COPY = "copy",
  CLEANUP = "cleanup",
}

export enum ContentIngestionWorkflowStepStatus {
  RUNNING = "running",
  SUCCESS = "success",
  FAILED = "failed",
}

export class BaseContentIngestionWorkflowStep {
  @ApiProperty({
    enum: () => ContentIngestionWorkflowStepType,
    enumName: "ContentIngestionWorkflowStepType",
    required: true,
    description: "The type of job the workflow step is performing",
  })
  type: ContentIngestionWorkflowStepType;
}

export class ContentIngestionWorkflowStep extends BaseContentIngestionWorkflowStep {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique identified for the workflow step",
  })
  id: string;

  @ApiProperty({
    enum: () => ContentIngestionWorkflowStepStatus,
    enumName: "ContentIngestionWorkflowStepStatus",
    required: true,
    description: "The status of the workflow step",
  })
  status: ContentIngestionWorkflowStepStatus;

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

export class MutableContentIngestionWorkflowStep extends OmitType(
  ContentIngestionWorkflowStep,
  ["id", "type", "createdTime", "lastUpdatedTime"],
) {}

export class PartialContentIngestionWorkflowStep extends PartialType(
  MutableContentIngestionWorkflowStep,
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateContentIngestionWorkflowStepRequest {
  @ApiProperty({
    required: true,
    type: () => BaseContentIngestionWorkflowStep,
    description: "The details of the workflow step to create",
  })
  step: BaseContentIngestionWorkflowStep;
}

export class UpdateContentIngestionWorkflowStepRequest {
  @ApiProperty({
    required: true,
    type: () => PartialContentIngestionWorkflowStep,
    description: "The details of the workflow step to update",
  })
  step: PartialContentIngestionWorkflowStep;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateContentIngestionWorkflowStepResponse {
  @ApiProperty({
    required: true,
    type: () => ContentIngestionWorkflowStep,
    description: "The newly created workflow step",
  })
  step: ContentIngestionWorkflowStep;
}

export class DescribeContentIngestionWorkflowStepResponse {
  @ApiProperty({
    required: true,
    type: () => ContentIngestionWorkflowStep,
    description: "The workflow step",
  })
  step: ContentIngestionWorkflowStep;
}

export class UpdateContentIngestionWorkflowStepResponse {
  @ApiProperty({
    required: true,
    type: () => ContentIngestionWorkflowStep,
    description: "The updated workflow step",
  })
  step: ContentIngestionWorkflowStep;
}

export class ListContentIngestionWorkflowStepsResponse {
  @ApiProperty({
    required: true,
    type: () => ContentIngestionWorkflowStep,
    isArray: true,
    description: "A list of workflow steps associated with the workflow",
  })
  steps: ContentIngestionWorkflowStep[];
}
