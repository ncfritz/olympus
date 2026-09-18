import { ApiProperty } from "@nestjs/swagger";
import { NUMBER_MATRIX_SCHEMA } from "../../common";
import {
  ContentIngestionWorkflowAssetLocation,
  ContentIngestionWorkflowStatus,
} from "./workflow";

export class ContentIngestionWorkflowStatisticsCategories {
  @ApiProperty({
    enum: () => ContentIngestionWorkflowStatus,
    enumName: "ContentIngestionWorkflowStatus",
    isArray: true,
    required: true,
    description: "The workflow statuses charted",
  })
  status: ContentIngestionWorkflowStatus[];

  @ApiProperty({
    enum: () => ContentIngestionWorkflowAssetLocation,
    enumName: "ContentIngestionWorkflowAssetLocation",
    isArray: true,
    required: true,
    description: "The asset sources charted",
  })
  source: ContentIngestionWorkflowAssetLocation[];
}

export class ContentIngestionWorkflowStatisticsSeries {
  @ApiProperty({
    type: Object,
    additionalProperties: NUMBER_MATRIX_SCHEMA,
    required: true,
    description: "Time series of workflow counts, keyed by status",
  })
  status: Record<ContentIngestionWorkflowStatus, number[][]>;

  @ApiProperty({
    type: Object,
    additionalProperties: { type: "number" },
    required: true,
    description: "Total workflow count, keyed by status",
  })
  statusAggregate: Record<ContentIngestionWorkflowStatus, number>;

  @ApiProperty({
    type: Object,
    additionalProperties: { type: "number" },
    required: true,
    description: "Total workflow count, keyed by asset source",
  })
  sourceAggregate: Record<ContentIngestionWorkflowAssetLocation, number>;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class GetContentIngestionWorkflowStatisticsResponse {
  @ApiProperty({
    type: () => ContentIngestionWorkflowStatisticsCategories,
    required: true,
    description: "The categories associated with each statistics series",
  })
  categories: ContentIngestionWorkflowStatisticsCategories;

  @ApiProperty({
    type: () => ContentIngestionWorkflowStatisticsSeries,
    required: true,
    description: "The series data",
  })
  series: ContentIngestionWorkflowStatisticsSeries;
}
