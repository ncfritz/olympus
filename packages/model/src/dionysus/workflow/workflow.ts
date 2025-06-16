import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PaginatedResults } from "../../ModelCommon";
import { WorkflowStep } from "./workflowStep";

export enum WorkflowStatus {
  CREATED = "created",
  STARTED = "started",
  SUCCESS = "success",
  FAILED = "failed",
}

export class Workflow {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  startedTime?: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  finishedTime?: Moment;

  @ApiProperty({ enum: WorkflowStatus })
  status: WorkflowStatus;

  @ApiProperty({ type: WorkflowStep, isArray: true })
  steps: WorkflowStep[];

  @ApiProperty({ type: Number })
  stepCount?: number;
}

export class PartialWorkflow extends OmitType(Workflow, [
  "id",
  "createdTime",
  "lastUpdatedTime",
  "steps",
  "stepCount",
]) {}

export class CreateWorkflowRequest {}

export class CreateWorkflowResponse {
  @ApiProperty({ type: () => Workflow })
  workflow: Workflow;
}

export class DescribeWorkflowResponse {
  @ApiProperty({ type: () => Workflow })
  workflow: Workflow;
}

export class UpdateWorkflowRequest {
  @ApiProperty({ type: () => PartialWorkflow })
  workflow: Partial<PartialWorkflow>;
}

export class UpdateWorkflowResponse {
  @ApiProperty({ type: () => Workflow })
  workflow: Workflow;
}

export class ListWorkflowsResponse extends PaginatedResults {
  @ApiProperty({ type: () => Workflow, isArray: true })
  workflows: Workflow[];
}
