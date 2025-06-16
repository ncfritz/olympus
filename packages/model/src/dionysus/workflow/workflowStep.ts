import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { BatchJob, JobType } from "../../BatchJobModel";

export enum WorkflowStepType {
  JOB_EXECUTION = "job_execution",
  RETRY = "retry",
}

export class WorkflowStep {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ enum: JobType })
  type: WorkflowStepType;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({ type: () => BatchJob })
  job?: BatchJob;

  @ApiProperty({ type: "number" })
  attempt: number;
}

export class PartialWorkflowStep extends OmitType(WorkflowStep, [
  "id",
  "job",
  "createdTime",
  "lastUpdatedTime",
]) {
  @ApiProperty({ enum: JobType })
  jobType: JobType;

  @ApiProperty({ type: Number, default: 0 })
  offset: number;
}

export class CreateWorkflowStepRequest {
  @ApiProperty({ type: () => PartialWorkflowStep })
  step: PartialWorkflowStep;
}

export class CreateWorkflowStepResponse {
  @ApiProperty({ type: () => WorkflowStep })
  step: WorkflowStep;
}

export class DescribeWorkflowStepResponse {
  @ApiProperty({ type: () => WorkflowStep })
  step: WorkflowStep;
}

export class ListWorkflowStepsResponse {
  @ApiProperty({ type: () => WorkflowStep, isArray: true })
  steps: WorkflowStep[];
}
