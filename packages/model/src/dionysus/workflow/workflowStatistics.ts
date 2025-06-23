import { ApiProperty } from "@nestjs/swagger";
import { WorkflowStatus } from "./workflow";

export class GetMetadataWorkflowStatisticsResponse {
  @ApiProperty({
    type: Object,
    additionalProperties: { type: "MetadataWorkflowStats" },
  })
  categories: {
    status: WorkflowStatus[];
  };

  @ApiProperty({
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
