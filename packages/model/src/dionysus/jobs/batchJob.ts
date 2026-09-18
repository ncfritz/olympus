import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
import {
  NUMBER_ARRAY_SCHEMA,
  NUMBER_MATRIX_SCHEMA,
  PaginatedResults,
} from "../../common";
import { MetadataFetchJobStatus, MetadataJobType } from "./fetchJob";

export enum JobType {
  MOVIES = "movies",
  TV_SERIES = "tv_series",
  TV_SEASONS = "tv_seasons",
  TV_EPISODES = "tv_episodes",
  PEOPLE = "people",
  COLLECTIONS = "collections",
  TV_NETWORKS = "tv_networks",
  KEYWORDS = "keywords",
  PRODUCTION_COMPANIES = "production_companies",
  CERTIFICATIONS = "certifications",
  GENRES = "genres",
  COUNTRIES = "countries",
  LANGUAGES = "languages",
  REDRIVE = "redrive",
}

export enum JobStatus {
  CREATED = "created",
  STARTED = "started",
  CANCELLED = "cancelled",
  SUCCESS = "success",
  FAILED = "failed",
}

export class BatchJob {
  @ApiProperty({ required: true, type: String })
  id: string;

  @ApiProperty({ required: true, enum: () => JobType, enumName: "JobType" })
  type: JobType;

  @ApiProperty({ required: true, enum: () => JobStatus, enumName: "JobStatus" })
  status: JobStatus;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;

  @ApiTimestamp({ required: false })
  startedTime?: Moment;

  @ApiTimestamp({ required: false })
  finishedTime?: Moment;

  @ApiProperty({ type: Number, required: false })
  totalRecords?: number;

  @ApiProperty({ type: Number, required: false })
  maxRecordsToProcess?: number;

  @ApiProperty({ type: Number, required: false })
  skippedRecords?: number;

  @ApiProperty({ type: Number, required: false })
  processedRecords?: number;

  @ApiProperty({ type: Number, required: false })
  duplicateRecords?: number;

  @ApiProperty({ type: Number, required: false })
  noOpRecords?: number;

  @ApiProperty({ type: Number, required: false })
  newRecords?: number;

  @ApiProperty({ type: Number, required: false })
  expiredRecords?: number;
}

export class PartialBatchJob extends OmitType(BatchJob, [
  "id",
  "type",
  "createdTime",
  "lastUpdatedTime",
]) {}

export class BatchJobTimingStatistics {
  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
  })
  queueTime: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
  })
  runtime: number[][];
}

export class BatchJobRecordStats {
  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
  })
  total: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
  })
  new: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
  })
  expired: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
  })
  noop: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
  })
  skipped: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
  })
  processed: number[][];
}

export class BatchJobStatsByTypeSeries {
  @ApiProperty({
    required: true,
    type: () => BatchJobRecordStats,
  })
  records: BatchJobRecordStats;

  @ApiProperty({
    required: true,
    type: () => BatchJobTimingStatistics,
  })
  timing: BatchJobTimingStatistics;
}

export class CreateBatchJobRequest {
  @ApiProperty({
    enum: () => JobType,
    enumName: "JobType",
    description: "The type of batch job to create",
    required: true,
  })
  type: JobType;

  @ApiProperty({
    type: Boolean,
    description:
      "Defaults to true, set to false to prevent publishing an AMQP message",
    required: false,
    default: true,
  })
  publishNotification?: boolean;

  @ApiProperty({
    type: Number,
    description: "Which record to start processing from",
    required: false,
    default: 0,
  })
  offset?: number;

  @ApiProperty({
    type: Number,
    description: "The maximum number of records to process",
    required: false,
    default: undefined,
  })
  maxRecordsToProcess?: number;
}

export class CreateRedriveJobRequest {
  @ApiProperty({
    enum: () => MetadataJobType,
    enumName: "MetadataJobType",
    description: "The type of entity to re-drive",
    required: true,
  })
  metadataType: MetadataJobType;

  @ApiProperty({
    enum: () => MetadataFetchJobStatus,
    enumName: "MetadataFetchJobStatus",
    description: "The status of the records to re-drive",
    required: true,
  })
  status: MetadataFetchJobStatus;

  @ApiProperty({
    enum: () => MetadataFetchJobStatus,
    enumName: "MetadataFetchJobStatus",
    description: "The status of the records after they have been re-driven",
    required: true,
  })
  targetStatus: MetadataFetchJobStatus;

  @ApiProperty({
    type: Boolean,
    description:
      "Defaults to true, set to false to prevent publishing an AMQP message",
    required: false,
    default: true,
  })
  publishNotification?: boolean;
}

export class CreateBatchJobResponse {
  @ApiProperty({
    required: true,
    type: () => BatchJob,
  })
  job: BatchJob;
}

export class DeleteBatchJobResponse {}

export class DescribeBatchJobResponse {
  @ApiProperty({
    required: true,
    type: () => BatchJob,
  })
  job: BatchJob;
}

export class BatchJobStatsCategories {
  @ApiProperty({
    enum: () => MetadataJobType,
    enumName: "MetadataJobType",
    isArray: true,
    required: true,
    description: "The categories (x-axis) of the status chart",
  })
  status: MetadataJobType[];

  @ApiProperty({
    enum: () => JobType,
    enumName: "JobType",
    isArray: true,
    required: true,
    description: "The categories of the timing charts",
  })
  timing: JobType[];
}

export class BatchJobStatsTiming {
  @ApiProperty({
    type: Object,
    additionalProperties: NUMBER_MATRIX_SCHEMA,
    required: true,
    description: "Queue time series, keyed by metadata job type",
  })
  queueTime: Record<MetadataJobType, number[][]>;

  @ApiProperty({
    type: Object,
    additionalProperties: NUMBER_MATRIX_SCHEMA,
    required: true,
    description: "Run time series, keyed by metadata job type",
  })
  runtime: Record<MetadataJobType, number[][]>;
}

export class BatchJobStatsSeries {
  @ApiProperty({
    type: Object,
    additionalProperties: NUMBER_ARRAY_SCHEMA,
    required: true,
    description: "Job counts per category, keyed by job status",
  })
  status: Record<JobStatus, number[]>;

  @ApiProperty({
    type: () => BatchJobStatsTiming,
    required: true,
    description: "Queue and run time series",
  })
  timing: BatchJobStatsTiming;
}

export class GetBatchJobStatsResponse {
  @ApiProperty({
    type: () => BatchJobStatsCategories,
    required: true,
    description: "The categories associated with each statistics series",
  })
  categories: BatchJobStatsCategories;

  @ApiProperty({
    type: () => BatchJobStatsSeries,
    required: true,
    description: "The series data",
  })
  series: BatchJobStatsSeries;
}

export class GetBatchJobStatsByTypeResponse {
  @ApiProperty({
    required: true,
    type: () => BatchJobStatsByTypeSeries,
  })
  series: BatchJobStatsByTypeSeries;
}

export class ListBatchJobsResponse extends PaginatedResults {
  @ApiProperty({ required: true, type: () => BatchJob, isArray: true })
  jobs: BatchJob[];
}

export class ListBatchJobsByTypeResponse extends PaginatedResults {
  @ApiProperty({ required: true, type: () => BatchJob, isArray: true })
  jobs: BatchJob[];
}

export class UpdateBatchJobRequest {
  @ApiProperty({
    required: true,
    type: () => PartialBatchJob,
  })
  job: PartialBatchJob;
}

export class UpdateBatchJobResponse {
  @ApiProperty({
    required: true,
    type: () => BatchJob,
  })
  job: BatchJob;
}
