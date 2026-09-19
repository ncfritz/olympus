import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import type { Moment } from "moment";
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
    enumSchema: { description: "Where the asset to ingest can be found" },
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
    enumSchema: { description: "The status of a content ingestion workflow" },
    required: true,
    description: "The status of the workflow",
  })
  status: ContentIngestionWorkflowStatus;

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
    required: true,
    type: () => BaseContentIngestionWorkflow,
    description: "The newly created workflow",
  })
  workflow: BaseContentIngestionWorkflow;
}

export class UpdateContentIngestionWorkflowRequest {
  @ApiProperty({
    required: true,
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
    required: true,
    type: () => ContentIngestionWorkflow,
    description: "The newly created workflow",
  })
  workflow: ContentIngestionWorkflow;
}

export class DescribeContentIngestionWorkflowResponse {
  @ApiProperty({
    required: true,
    type: () => ContentIngestionWorkflow,
    description: "The workflow",
  })
  workflow: ContentIngestionWorkflow;
}

export class UpdateContentIngestionWorkflowResponse {
  @ApiProperty({
    required: true,
    type: () => ContentIngestionWorkflow,
    description: "The updated workflow",
  })
  workflow: ContentIngestionWorkflow;
}

export class ListContentIngestionWorkflowsResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => ContentIngestionWorkflow,
    isArray: true,
    description: "A list of workflows",
  })
  workflows: ContentIngestionWorkflow[];
}

export class UploadAssetsResponse {
  @ApiProperty({
    type: () => ContentIngestionWorkflow,
    isArray: true,
    required: true,
    description:
      "The content ingestion workflows started, one per uploaded file",
  })
  workflows: ContentIngestionWorkflow[];
}
