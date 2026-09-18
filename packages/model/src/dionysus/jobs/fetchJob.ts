import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import moment, { Moment } from "moment";
import {
  ChartSeries,
  NUMBER_ARRAY_SCHEMA,
  PaginatedResults,
} from "../../common";

export enum MetadataFetchJobStatus {
  QUEUED = "queued",
  INVALIDATED = "invalidated",
  FETCHING = "fetching",
  CANCELLED = "cancelled",
  FETCHED = "fetched",
  FAILED = "failed",
  NOT_FOUND = "not_found",
}

export enum MetadataJobType {
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
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class FetchJobContext<K extends keyof never, T> {}

export class MetadataFetchJob {
  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB ID of the entity to fetch; unique per job type",
  })
  id: string;

  @ApiProperty({
    required: true,
    enum: () => MetadataJobType,
    enumName: "MetadataJobType",
    description: "The kind of entity to fetch",
  })
  type: MetadataJobType;

  @ApiProperty({
    required: true,
    enum: () => MetadataFetchJobStatus,
    enumName: "MetadataFetchJobStatus",
    description: "The status of the fetch job",
  })
  status: MetadataFetchJobStatus;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the metadata fetch job was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the metadata fetch job was last updated",
  })
  lastUpdatedTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the metadata was last fetched",
  })
  lastFetchedTime?: Moment;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of days fetched metadata stays fresh",
  })
  ttl: number;

  @ApiProperty({
    required: true,
    type: Number,
    description:
      "The number of minutes added to the expiry to spread out refetches",
  })
  jitter: number;

  @ApiProperty({
    required: true,
    type: () => FetchJobContext,
    description: "Type-specific context passed to the metadata agent",
  })
  context: FetchJobContext<string, never>;
}

export class PartialMetadataFetchJob extends OmitType(MetadataFetchJob, [
  "id",
  "type",
  "createdTime",
  "lastUpdatedTime",
]) {}
export class MetadatFetchJobUpdate extends PartialType(
  PartialMetadataFetchJob,
) {}

export class CreateMetadataFetchJobRequest {
  @ApiProperty({
    type: String,
    description: "The id of the TMDB entity to create a job for",
    required: true,
  })
  id: string;

  @ApiProperty({
    enum: () => MetadataJobType,
    enumName: "MetadataJobType",
    description: "The type of metadata fetch job to create",
    required: true,
  })
  type: MetadataJobType;

  @ApiProperty({
    type: Number,
    description: "The number of days until the record expires",
    required: false,
  })
  ttl?: number;

  @ApiProperty({
    type: Number,
    description: "The number of minutes to jitter the expirations",
    required: false,
  })
  jitter?: number;

  @ApiProperty({
    enum: () => MetadataFetchJobStatus,
    enumName: "MetadataFetchJobStatus",
    description: "The initial status of the job",
    required: false,
    default: MetadataFetchJobStatus.QUEUED,
  })
  status?: MetadataFetchJobStatus;

  @ApiProperty({
    type: String,
    required: false,
    default: undefined,
    description:
      "An ISO-8601 formatted string indicating when the metadata was last fetched, if known",
  })
  @Transform(({ value }) => (value ? moment(value) : undefined))
  lastFetchedTime?: Moment;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: true,
    description: "Whether to publish a notification when the fetch completes",
  })
  publishNotification?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description:
      "Whether to skip the local status cache and read the status directly from the database",
  })
  bypassCache?: boolean;

  @ApiProperty({
    type: () => FetchJobContext,
    required: false,
    description: "Type-specific context passed to the metadata agent",
  })
  context?: FetchJobContext<string, never>;
}

export class CreateMetadataFetchJobResponse {
  @ApiProperty({
    required: true,
    type: () => MetadataFetchJob,
    description: "The created metadata fetch job",
  })
  job: MetadataFetchJob;
}

export class DescribeMetadataFetchJobResponse {
  @ApiProperty({
    required: true,
    type: () => MetadataFetchJob,
    description: "The requested metadata fetch job",
  })
  job: MetadataFetchJob;
}

export class DeleteMetadataFetchJobResponse {
  @ApiProperty({
    required: true,
    type: () => MetadataFetchJob,
    description: "The deleted metadata fetch job",
  })
  job: MetadataFetchJob;
}

export class UpdateMetadataFetchJobRequest {
  @ApiProperty({
    required: true,
    type: () => MetadatFetchJobUpdate,
    description: "The changes to apply to the metadata fetch job",
  })
  job: MetadatFetchJobUpdate;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: true,
    description: "Whether to publish a notification when the fetch completes",
  })
  publishNotification?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description:
      "Whether to skip the local status cache and read the status directly from the database",
  })
  bypassCache?: boolean;
}

export class UpdateMetadataFetchJobResponse {
  @ApiProperty({
    required: true,
    type: () => MetadataFetchJob,
    description: "The updated metadata fetch job",
  })
  job: MetadataFetchJob;
}

/** @deprecated Use ChartSeries. Kept so existing imports compile. */
export type Series = ChartSeries;

export class MetadataFetchJobStatusStatistics {
  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "The metadata categories (x-axis)",
  })
  categories: string[];

  @ApiProperty({
    type: Object,
    additionalProperties: NUMBER_ARRAY_SCHEMA,
    required: true,
    description: "Job counts per category, keyed by fetch job status",
  })
  series: Record<MetadataFetchJobStatus, number[]>;
}

export class MetadataFetchJobExpirationStatistics {
  @ApiProperty({
    type: () => ChartSeries,
    isArray: true,
    required: true,
    description:
      "One series per metadata category; values by days until expiry",
  })
  series: ChartSeries[];
}

export class GetMetadataFetchJobStatusStatisticsResponse {
  @ApiProperty({
    type: () => MetadataFetchJobStatusStatistics,
    required: true,
    description: "Fetch job counts by status and category",
  })
  status: MetadataFetchJobStatusStatistics;

  @ApiProperty({
    type: () => MetadataFetchJobExpirationStatistics,
    required: true,
    description: "Fetched entries by days until they expire",
  })
  expiration: MetadataFetchJobExpirationStatistics;
}

export class ListMetadataFetchJobsResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => MetadataFetchJob,
    isArray: true,
    description: "The metadata fetch jobs on the requested page",
  })
  jobs: MetadataFetchJob[];
}
