import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { WorkflowStep } from "./workflowStep";

export enum WorkflowStatus {
  CREATED = "created",
  STARTED = "started",
  SUCCESS = "success",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export class Workflow {
  @ApiProperty({
    required: true,
    type: String,
    description: "The unique ID of the workflow",
  })
  id: string;

  @ApiProperty({
    required: true,
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the workflow was created.",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    required: true,
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
    required: true,
    enum: () => WorkflowStatus,
    enumName: "WorkflowStatus",
    description: "The status of the workflow.",
  })
  status: WorkflowStatus;

  @ApiProperty({
    required: true,
    type: WorkflowStep,
    isArray: true,
    description:
      "A list of the steps that have been performed, or are being performed, by the workflow",
  })
  steps: WorkflowStep[];

  @ApiProperty({
    type: Number,
    description:
      "The total number of steps that have been performed, or are being performed, by the workflow",
    required: false,
  })
  stepCount?: number;
}

export class MutableWorkflow extends OmitType(Workflow, [
  "id",
  "createdTime",
  "lastUpdatedTime",
  "steps",
  "stepCount",
]) {}

export class PartialWorkflow extends PartialType(MutableWorkflow) {}

export class CreateWorkflowRequest {}

export class CreateWorkflowResponse {
  @ApiProperty({
    required: true,
    type: () => Workflow,
    description: "The workflow to create",
  })
  workflow: Workflow;
}

export class DescribeWorkflowResponse {
  @ApiProperty({
    required: true,
    type: () => Workflow,
    description: "The newly created workflow",
  })
  workflow: Workflow;
}

export class UpdateWorkflowRequest {
  @ApiProperty({
    required: true,
    type: () => PartialWorkflow,
    description:
      "A partial workflow representing the changes to make to an existing workflow",
  })
  workflow: PartialWorkflow;
}

export class UpdateWorkflowResponse {
  @ApiProperty({
    required: true,
    type: () => Workflow,
    description: "The updated workflow",
  })
  workflow: Workflow;
}

export class ListWorkflowsResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => Workflow,
    isArray: true,
    description: "A list of workflows",
  })
  workflows: Workflow[];
}
