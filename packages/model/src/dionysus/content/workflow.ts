import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";
import { ContentIngestionWorkflowStep } from "./workflowStep";

export enum ContentIngestionWorkflowAssetLocation {
  LOCAL = "local",
  REMOTE = "remote",
}

export enum ContentIngestionWorkflowStatus {
  QUEUED = "queued",
  RUNNING = "running",
  SUCCESS = "success",
  FAILED = "failed",
  DUPLICATE = "duplicate",
  SKIPPED = "skipped",
}

export class BaseContentIngestionWorkflow {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The source of the asset to ingest.  This should be either a path to a local file or a fully formed HTTP URL",
  })
  source: string;

  @ApiProperty({
    enum: () => ContentIngestionWorkflowAssetLocation,
    enumName: "ContentIngestionWorkflowAssetLocation",
    required: true,
    description: "The type of location where the asset to ingest can be found",
  })
  sourceType: ContentIngestionWorkflowAssetLocation;
}

export class ContentIngestionWorkflow extends BaseContentIngestionWorkflow {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the workflow",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The temporary location where the input file and all outputs will be staged prior to upload to Dionysus",
  })
  tempLocation: string;

  @ApiProperty({
    enum: () => ContentIngestionWorkflowStatus,
    enumName: "ContentIngestionWorkflowStatus",
    required: true,
    description: "The status of the workflow",
  })
  status: ContentIngestionWorkflowStatus;

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

  @ApiProperty({
    type: ContentIngestionWorkflowStep,
    required: true,
    isArray: true,
    description:
      "A list of the steps that have been performed, or are being performed, by the workflow",
  })
  steps: ContentIngestionWorkflowStep[];

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The total number of steps that have been performed, or are being performed, by the workflow",
  })
  stepCount?: number;
}

export class MutableContentIngestionWorkflow extends OmitType(
  ContentIngestionWorkflow,
  [
    "id",
    "source",
    "sourceType",
    "createdTime",
    "lastUpdatedTime",
    "steps",
    "stepCount",
  ],
) {}

export class PartialContentIngestionWorkflow extends PartialType(
  MutableContentIngestionWorkflow,
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateContentIngestionWorkflowRequest {
  @ApiProperty({
    type: () => BaseContentIngestionWorkflow,
    description: "The newly created workflow",
  })
  workflow: BaseContentIngestionWorkflow;
}

export class UpdateContentIngestionWorkflowRequest {
  @ApiProperty({
    type: () => PartialContentIngestionWorkflow,
    description:
      "A partial workflow representing the changes to make to an existing workflow",
  })
  workflow: PartialContentIngestionWorkflow;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateContentIngestionWorkflowResponse {
  @ApiProperty({
    type: () => ContentIngestionWorkflow,
    description: "The newly created workflow",
  })
  workflow: ContentIngestionWorkflow;
}

export class DescribeContentIngestionWorkflowResponse {
  @ApiProperty({
    type: () => ContentIngestionWorkflow,
    description: "The workflow",
  })
  workflow: ContentIngestionWorkflow;
}

export class UpdateContentIngestionWorkflowResponse {
  @ApiProperty({
    type: () => ContentIngestionWorkflow,
    description: "The updated workflow",
  })
  workflow: ContentIngestionWorkflow;
}

export class ListContentIngestionWorkflowsResponse extends PaginatedResults {
  @ApiProperty({
    type: () => ContentIngestionWorkflow,
    isArray: true,
    description: "A list of workflows",
  })
  workflows: ContentIngestionWorkflow[];
}
