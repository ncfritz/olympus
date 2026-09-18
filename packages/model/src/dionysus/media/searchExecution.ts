import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PaginatedResults } from "../../common";

export enum SearchExecutionStatus {
  RUNNING = "running",
  SKIPPED = "skipped",
  SUCCESS = "success",
  FAILED = "failed",
}

export class MediaAssetSearchExecution {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the search execution",
  })
  id: string;

  @ApiProperty({
    enum: () => SearchExecutionStatus,
    enumName: "SearchExecutionStatus",
    required: true,
    description: "The status of the search execution",
  })
  status: SearchExecutionStatus;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search execution stated",
  })
  @Transform(({ value }) => value.toISOString())
  startedTime: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the search execution finished",
  })
  @Transform(({ value }) => value.toISOString())
  finishedTime?: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of new entities found during the search",
  })
  newRecords: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of duplicate entities found during the search",
  })
  duplicateRecords: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of entities that did not meet search criteria",
  })
  skippedRecords: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The total number of entities found during the search",
  })
  totalRecords: number;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search configuration was created",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search configuration was last updated",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMediaAssetSearchExecution extends PartialType(
  OmitType(MediaAssetSearchExecution, [
    "id",
    "startedTime",
    "createdTime",
    "lastUpdatedTime",
  ]),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateMediaAssetSearchExecutionRequest {}

export class UpdateMediaAssetSearchExecutionRequest {
  @ApiProperty({
    type: () => PartialMediaAssetSearchExecution,
    required: true,
    description:
      "A partial media asset search execution containing the fields to update",
  })
  searchExecution: PartialMediaAssetSearchExecution;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class SingleMediaAssetSearchExecutionResponse {
  @ApiProperty({
    type: () => MediaAssetSearchExecution,
    required: true,
    description:
      "A search execution that has been created, updated, or queried",
  })
  searchExecution: MediaAssetSearchExecution;
}

export class ListMediaAssetSearchExecutionsResponse extends PaginatedResults {
  @ApiProperty({
    type: () => MediaAssetSearchExecution,
    isArray: true,
    required: true,
    description:
      "A search execution that has been created, updated, or queried",
  })
  searchExecutions: MediaAssetSearchExecution[];
}
