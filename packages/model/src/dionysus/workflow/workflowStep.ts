import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { BatchJob, JobType } from "../jobs/batchJob";

export enum WorkflowStepType {
  JOB_EXECUTION = "job_execution",
  RETRY = "retry",
}

export class WorkflowStep {
  @ApiProperty({
    type: String,
    description: "The unique identified for the workflow step",
  })
  id: string;

  @ApiProperty({
    enum: () => WorkflowStepType,
    enumName: "WorkflowStepType",
    description: "The type of step",
  })
  type: WorkflowStepType;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the workflow step was created.",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the workflow step was last updated.",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: () => BatchJob,
    description: "The BatchJob that this workflow step is running",
    required: false,
  })
  job?: BatchJob;

  @ApiProperty({
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
    enum: () => JobType,
    enumName: "JobType",
    description:
      "The type of BatchJob to create and associate with the workflow step",
  })
  jobType: JobType;

  @ApiProperty({
    type: Number,
    default: 0,
    description: "The number of records to skip when the BatchJob runs",
  })
  offset: number;
}

export class CreateWorkflowStepRequest {
  @ApiProperty({
    type: () => PartialWorkflowStep,
    description: "The details of the workflow step to create",
  })
  step: PartialWorkflowStep;
}

export class CreateWorkflowStepResponse {
  @ApiProperty({
    type: () => WorkflowStep,
    description: "The newly created workflow step",
  })
  step: WorkflowStep;
}

export class DescribeWorkflowStepResponse {
  @ApiProperty({ type: () => WorkflowStep, description: "The workflow step" })
  step: WorkflowStep;
}

export class ListWorkflowStepsResponse {
  @ApiProperty({
    type: () => WorkflowStep,
    isArray: true,
    description: "A list of workflow steps associated with the workflow",
  })
  steps: WorkflowStep[];
}
