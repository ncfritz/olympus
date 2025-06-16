import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { LogLine, MetadataFetchJobStatus, MetadataJobType } from "./index";

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

export class CreateBatchJobRequest {
  @ApiProperty({
    enum: JobType,
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
    enum: MetadataJobType,
    description: "The status of the records to re-drive",
    required: true,
  })
  metadataType?: MetadataJobType;

  @ApiProperty({
    enum: MetadataFetchJobStatus,
    description: "The status of the records to re-drive",
    required: true,
  })
  status?: MetadataFetchJobStatus;

  @ApiProperty({
    enum: MetadataFetchJobStatus,
    description: "The status of the records after they have been re-driven",
    required: true,
  })
  targetStatus?: MetadataFetchJobStatus;

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
    type: () => BatchJob,
  })
  job: BatchJob;
}

export class DeleteBatchJobResponse {}

export class DescribeBatchJobResponse {
  @ApiProperty({
    type: () => BatchJob,
  })
  job: BatchJob;
}

export class GetBatchJobLogsResponse {
  @ApiProperty({ type: String })
  jobId: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastEventTimestamp: Moment;

  @ApiProperty({ type: () => LogLine, isArray: true })
  logs: LogLine[];
}

export class GetBatchJobStatsResponse {
  @ApiProperty({
    type: Object,
    additionalProperties: { type: "BatchJobStats" },
  })
  categories: {
    status: MetadataJobType[];
    timing: JobType[];
  };

  @ApiProperty({
    type: Object,
    additionalProperties: { type: "BatchJobStats" },
  })
  series: {
    status: Record<JobStatus, number[]>;
    timing: {
      queueTime: Record<MetadataJobType, number[][]>;
      runtime: Record<MetadataJobType, number[][]>;
    };
  };
}

export class GetBatchJobStatsByTypeResponse {
  @ApiProperty({
    type: Object,
    additionalProperties: { type: "BatchJobStats" },
  })
  series: {
    records: Record<string, number[][]>;
    timing: {
      queueTime: number[][];
      runtime: number[][];
    };
  };
}

export class ListBatchJobsResponse {
  @ApiProperty({ type: () => BatchJob, isArray: true })
  jobs: BatchJob[];
}

export class ListBatchJobsByTypeResponse {
  @ApiProperty({ type: () => BatchJob, isArray: true })
  jobs: BatchJob[];
}

export class UpdateBatchJobRequest {
  @ApiProperty({
    type: () => PartialBatchJob,
  })
  job: PartialBatchJob;
}

export class UpdateBatchJobResponse {
  @ApiProperty({
    type: () => BatchJob,
  })
  job: BatchJob;
}

export class BatchJob {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ enum: JobType })
  type: JobType;

  @ApiProperty({ enum: JobStatus })
  status: JobStatus;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  startedTime?: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  finishedTime?: Moment;

  @ApiProperty({ type: Number })
  totalRecords: number;

  @ApiProperty({ type: Number })
  maxRecordsToProcess?: number;

  @ApiProperty({ type: Number })
  skippedRecords: number;

  @ApiProperty({ type: Number })
  processedRecords: number;

  @ApiProperty({ type: Number })
  duplicateRecords: number;

  @ApiProperty({ type: Number })
  noOpRecords: number;

  @ApiProperty({ type: Number })
  newRecords: number;

  @ApiProperty({ type: Number })
  expiredRecords: number;
}

export class PartialBatchJob extends OmitType(BatchJob, [
  "id",
  "type",
  "createdTime",
  "lastUpdatedTime",
]) {}

export class BatchJobStats {
  @ApiProperty({ enum: JobStatus })
  status: JobStatus;

  @ApiProperty({ type: Number })
  totalRecords: number;

  @ApiProperty({ type: Number })
  duplicateRecords: number;

  @ApiProperty({ type: Number })
  noOpRecords: number;

  @ApiProperty({ type: Number })
  newRecords: number;

  @ApiProperty({ type: Number })
  expiredRecords: number;
}
