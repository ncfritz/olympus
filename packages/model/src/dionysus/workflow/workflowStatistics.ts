import { ApiProperty } from "@nestjs/swagger";
import { WorkflowStatus } from "./workflow";

export class GetMetadataWorkflowStatisticsResponse {
  @ApiProperty({
    required: true,
    type: Object,
    additionalProperties: { type: "MetadataWorkflowStats" },
  })
  categories: {
    status: WorkflowStatus[];
  };

  @ApiProperty({
    required: true,
    type: Object,
    additionalProperties: { type: "MetadataWorkflowStats" },
  })
  series: {
    status: Record<WorkflowStatus, number[][]>;
    timing: {
      queueTime: number[][];
      runtime: number[][];
    };
  };
}
