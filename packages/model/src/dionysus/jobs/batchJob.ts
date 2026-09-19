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
  @ApiProperty({
    required: true,
    type: String,
    description: "The unique ID of the batch job",
  })
  id: string;

  @ApiProperty({
    required: true,
    enum: () => JobType,
    enumName: "JobType",
    enumSchema: { description: "The type of a batch job" },
    description: "The kind of metadata the batch job processes",
  })
  type: JobType;

  @ApiProperty({
    required: true,
    enum: () => JobStatus,
    enumName: "JobStatus",
    description: "The status of the batch job",
  })
  status: JobStatus;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the batch job was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the batch job was last updated",
  })
  lastUpdatedTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the batch job started",
  })
  startedTime?: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the batch job finished",
  })
  finishedTime?: Moment;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The number of records in the export being processed",
  })
  totalRecords?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The maximum number of records to process; all records when not set",
  })
  maxRecordsToProcess?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The number of records skipped without being processed",
  })
  skippedRecords?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The number of records processed so far",
  })
  processedRecords?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The number of records whose existing fetch job has never successfully fetched metadata",
  })
  duplicateRecords?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The number of records whose metadata was still fresh, so nothing was done",
  })
  noOpRecords?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The number of records that created a new metadata fetch job",
  })
  newRecords?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The number of records whose metadata had expired and was queued for refetch",
  })
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
    description: "Time spent queued, as [timestamp, value] pairs",
  })
  queueTime: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
    description: "Time spent running, as [timestamp, value] pairs",
  })
  runtime: number[][];
}

export class BatchJobRecordStats {
  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
    description: "Total records per job, as [timestamp, value] pairs",
  })
  total: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
    description: "New records per job, as [timestamp, value] pairs",
  })
  new: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
    description: "Expired records per job, as [timestamp, value] pairs",
  })
  expired: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
    description: "No-op records per job, as [timestamp, value] pairs",
  })
  noop: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
    description: "Skipped records per job, as [timestamp, value] pairs",
  })
  skipped: number[][];

  @ApiProperty({
    required: true,
    type: "array",
    items: { type: "array", items: { type: "number" } },
    description: "Processed records per job, as [timestamp, value] pairs",
  })
  processed: number[][];
}

export class BatchJobStatsByTypeSeries {
  @ApiProperty({
    required: true,
    type: () => BatchJobRecordStats,
    description: "Record count series",
  })
  records: BatchJobRecordStats;

  @ApiProperty({
    required: true,
    type: () => BatchJobTimingStatistics,
    description: "Queue and run time series",
  })
  timing: BatchJobTimingStatistics;
}

export class CreateBatchJobRequest {
  @ApiProperty({
    enum: () => JobType,
    enumName: "JobType",
    enumSchema: { description: "The type of a batch job" },
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
    enumSchema: {
      description: "The type of entity a metadata fetch job retrieves",
    },
    description: "The type of entity to re-drive",
    required: true,
  })
  metadataType: MetadataJobType;

  @ApiProperty({
    enum: () => MetadataFetchJobStatus,
    enumName: "MetadataFetchJobStatus",
    enumSchema: { description: "The status of a metadata fetch job" },
    description: "The status of the records to re-drive",
    required: true,
  })
  status: MetadataFetchJobStatus;

  @ApiProperty({
    enum: () => MetadataFetchJobStatus,
    enumName: "MetadataFetchJobStatus",
    enumSchema: { description: "The status of a metadata fetch job" },
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
    description: "The created batch job",
  })
  job: BatchJob;
}

export class DeleteBatchJobResponse {}

export class DescribeBatchJobResponse {
  @ApiProperty({
    required: true,
    type: () => BatchJob,
    description: "The requested batch job",
  })
  job: BatchJob;
}

export class BatchJobStatsCategories {
  @ApiProperty({
    enum: () => MetadataJobType,
    enumName: "MetadataJobType",
    enumSchema: {
      description: "The type of entity a metadata fetch job retrieves",
    },
    isArray: true,
    required: true,
    description: "The categories (x-axis) of the status chart",
  })
  status: MetadataJobType[];

  @ApiProperty({
    enum: () => JobType,
    enumName: "JobType",
    enumSchema: { description: "The type of a batch job" },
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
    description: "The statistics series for the requested job type",
  })
  series: BatchJobStatsByTypeSeries;
}

export class ListBatchJobsResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => BatchJob,
    isArray: true,
    description: "The batch jobs on the requested page",
  })
  jobs: BatchJob[];
}

export class ListBatchJobsByTypeResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => BatchJob,
    isArray: true,
    description: "The batch jobs of the requested type on the requested page",
  })
  jobs: BatchJob[];
}

export class UpdateBatchJobRequest {
  @ApiProperty({
    required: true,
    type: () => PartialBatchJob,
    description: "The changes to apply to the batch job",
  })
  job: PartialBatchJob;
}

export class UpdateBatchJobResponse {
  @ApiProperty({
    required: true,
    type: () => BatchJob,
    description: "The updated batch job",
  })
  job: BatchJob;
}
