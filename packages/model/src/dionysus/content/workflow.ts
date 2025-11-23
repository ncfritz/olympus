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
  @ApiProperty({ type: String, required: true })
  source: string;

  @ApiProperty({
    enum: () => ContentIngestionWorkflowAssetLocation,
    enumName: "ContentIngestionWorkflowAssetLocation",
  })
  sourceType: ContentIngestionWorkflowAssetLocation;
}

export class ContentIngestionWorkflow extends BaseContentIngestionWorkflow {
  @ApiProperty({ type: String, required: true })
  id: string;

  @ApiProperty({ type: String, required: true })
  tempLocation: string;

  @ApiProperty({
    enum: () => ContentIngestionWorkflowStatus,
    enumName: "ContentIngestionWorkflowStatus",
  })
  status: ContentIngestionWorkflowStatus;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the workflow was created.",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the workflow was last updated.",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the workflow was started.",
    required: false,
  })
  @ApiProperty({ type: String })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  startedTime?: Moment;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the workflow finished.",
    required: false,
  })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  finishedTime?: Moment;

  @ApiProperty({
    type: ContentIngestionWorkflowStep,
    isArray: true,
    description:
      "A list of the steps that have been performed, or are being performed, by the workflow",
  })
  steps: ContentIngestionWorkflowStep[];

  @ApiProperty({
    type: Number,
    description:
      "The total number of steps that have been performed, or are being performed, by the workflow",
    required: false,
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

export class CreateContentIngestionWorkflowRequest {
  @ApiProperty({
    type: () => BaseContentIngestionWorkflow,
    description: "The newly created workflow",
  })
  workflow: BaseContentIngestionWorkflow;
}

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

export class UpdateContentIngestionWorkflowRequest {
  @ApiProperty({
    type: () => PartialContentIngestionWorkflow,
    description:
      "A partial workflow representing the changes to make to an existing workflow",
  })
  workflow: PartialContentIngestionWorkflow;
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
