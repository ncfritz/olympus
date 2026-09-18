import { ApiProperty } from "@nestjs/swagger";
import {
  ContentIngestionWorkflowAssetLocation,
  ContentIngestionWorkflowStatus,
} from "./workflow";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class GetContentIngestionWorkflowStatisticsResponse {
  @ApiProperty({
    type: Object,
    additionalProperties: { type: "ContentIngestionWorkflowStats" },
    required: true,
    description: "The categories associated with each statistics series",
  })
  categories: {
    status: ContentIngestionWorkflowStatus[];
    source: ContentIngestionWorkflowAssetLocation[];
  };

  @ApiProperty({
    type: Object,
    additionalProperties: { type: "ContentIngestionWorkflowStats" },
    required: true,
    description: "The series data",
  })
  series: {
    status: Record<ContentIngestionWorkflowStatus, number[][]>;
    statusAggregate: Record<ContentIngestionWorkflowStatus, number>;
    sourceAggregate: Record<ContentIngestionWorkflowAssetLocation, number>;
  };
}
