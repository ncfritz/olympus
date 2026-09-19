import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { BatchJob, JobType } from "../jobs";

export enum WorkflowStepType {
  JOB_EXECUTION = "job_execution",
  RETRY = "retry",
}

export class WorkflowStep {
  @ApiProperty({
    required: true,
    type: String,
    description: "The unique identified for the workflow step",
  })
  id: string;

  @ApiProperty({
    required: true,
    enum: () => WorkflowStepType,
    enumName: "WorkflowStepType",
    description: "The type of step",
  })
  type: WorkflowStepType;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the workflow step was created.",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the workflow step was last updated.",
  })
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: () => BatchJob,
    description: "The BatchJob that this workflow step is running",
    required: false,
  })
  job?: BatchJob;

  @ApiProperty({
    required: true,
    type: "number",
    description: "The attempt count for this workflow step",
  })
  attempt: number;
}

export class PartialWorkflowStep extends OmitType(WorkflowStep, [
  "id",
  "job",
  "createdTime",
  "lastUpdatedTime",
]) {
  @ApiProperty({
    required: true,
    enum: () => JobType,
    enumName: "JobType",
    enumSchema: { description: "The type of a batch job" },
    description:
      "The type of BatchJob to create and associate with the workflow step",
  })
  jobType: JobType;

  @ApiProperty({
    required: true,
    type: Number,
    default: 0,
    description: "The number of records to skip when the BatchJob runs",
  })
  offset: number;
}

export class CreateWorkflowStepRequest {
  @ApiProperty({
    required: true,
    type: () => PartialWorkflowStep,
    description: "The details of the workflow step to create",
  })
  step: PartialWorkflowStep;
}

export class CreateWorkflowStepResponse {
  @ApiProperty({
    required: true,
    type: () => WorkflowStep,
    description: "The newly created workflow step",
  })
  step: WorkflowStep;
}

export class DescribeWorkflowStepResponse {
  @ApiProperty({
    required: true,
    type: () => WorkflowStep,
    description: "The workflow step",
  })
  step: WorkflowStep;
}

export class ListWorkflowStepsResponse {
  @ApiProperty({
    required: true,
    type: () => WorkflowStep,
    isArray: true,
    description: "A list of workflow steps associated with the workflow",
  })
  steps: WorkflowStep[];
}
