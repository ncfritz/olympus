import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import type { Moment } from "moment";
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
