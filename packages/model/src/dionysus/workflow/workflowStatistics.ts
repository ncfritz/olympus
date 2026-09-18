import { ApiProperty } from "@nestjs/swagger";
import { NUMBER_MATRIX_SCHEMA } from "../../common";
import { WorkflowStatus } from "./workflow";

export class MetadataWorkflowStatisticsCategories {
  @ApiProperty({
    enum: () => WorkflowStatus,
    enumName: "WorkflowStatus",
    isArray: true,
    required: true,
    description: "The workflow statuses charted",
  })
  status: WorkflowStatus[];
}

export class MetadataWorkflowStatisticsTiming {
  @ApiProperty({
    type: "array",
    items: NUMBER_MATRIX_SCHEMA.items,
    required: true,
    description: "Queue time series as [timestamp, value] pairs",
  })
  queueTime: number[][];

  @ApiProperty({
    type: "array",
    items: NUMBER_MATRIX_SCHEMA.items,
    required: true,
    description: "Run time series as [timestamp, value] pairs",
  })
  runtime: number[][];
}

export class MetadataWorkflowStatisticsSeries {
  @ApiProperty({
    type: Object,
    additionalProperties: NUMBER_MATRIX_SCHEMA,
    required: true,
    description: "Time series of workflow counts, keyed by status",
  })
  status: Record<WorkflowStatus, number[][]>;

  @ApiProperty({
    type: () => MetadataWorkflowStatisticsTiming,
    required: true,
    description: "Queue and run time series",
  })
  timing: MetadataWorkflowStatisticsTiming;
}

export class GetMetadataWorkflowStatisticsResponse {
  @ApiProperty({
    type: () => MetadataWorkflowStatisticsCategories,
    required: true,
    description: "The categories associated with each statistics series",
  })
  categories: MetadataWorkflowStatisticsCategories;

  @ApiProperty({
    type: () => MetadataWorkflowStatisticsSeries,
    required: true,
    description: "The series data",
  })
  series: MetadataWorkflowStatisticsSeries;
}
