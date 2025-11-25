import { ApiProperty } from "@nestjs/swagger";
import {
  ContentIngestionWorkflowAssetLocation,
  ContentIngestionWorkflowStatus,
} from "./workflow";

export class GetContentIngestionWorkflowStatisticsResponse {
  @ApiProperty({
    type: Object,
    additionalProperties: { type: "ContentIngestionWorkflowStats" },
  })
  categories: {
    status: ContentIngestionWorkflowStatus[];
    source: ContentIngestionWorkflowAssetLocation[];
  };

  @ApiProperty({
    type: Object,
    additionalProperties: { type: "ContentIngestionWorkflowStats" },
  })
  series: {
    status: Record<ContentIngestionWorkflowStatus, number[][]>;
    statusAggregate: Record<ContentIngestionWorkflowStatus, number>;
    sourceAggregate: Record<ContentIngestionWorkflowAssetLocation, number>;
  };
}
