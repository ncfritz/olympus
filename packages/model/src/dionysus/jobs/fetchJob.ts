import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import moment, { Moment } from "moment";
import { PaginatedResults } from "../../common";

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
  @ApiProperty({ required: true, type: String })
  id: string;

  @ApiProperty({
    required: true,
    enum: () => MetadataJobType,
    enumName: "MetadataJobType",
  })
  type: MetadataJobType;

  @ApiProperty({
    required: true,
    enum: () => MetadataFetchJobStatus,
    enumName: "MetadataFetchJobStatus",
  })
  status: MetadataFetchJobStatus;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({ required: false, type: String })
  @Transform(({ value }) => value.toISOString())
  lastFetchedTime?: Moment;

  @ApiProperty({ required: true, type: Number })
  ttl: number;

  @ApiProperty({ required: true, type: Number })
  jitter: number;

  @ApiProperty({
    required: true,
    type: () => FetchJobContext,
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

  @ApiProperty({ type: String, required: false, default: undefined })
  @Transform(({ value }) => (value ? moment(value) : undefined))
  lastFetchedTime?: Moment;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: true,
  })
  publishNotification?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
  })
  bypassCache?: boolean;

  @ApiProperty({
    type: () => FetchJobContext,
    required: false,
  })
  context?: FetchJobContext<string, never>;
}

export class CreateMetadataFetchJobResponse {
  @ApiProperty({
    required: true,
    type: () => MetadataFetchJob,
  })
  job: MetadataFetchJob;
}

export class DescribeMetadataFetchJobResponse {
  @ApiProperty({
    required: true,
    type: () => MetadataFetchJob,
  })
  job: MetadataFetchJob;
}

export class DeleteMetadataFetchJobResponse {
  @ApiProperty({
    required: true,
    type: () => MetadataFetchJob,
  })
  job: MetadataFetchJob;
}

export class UpdateMetadataFetchJobRequest {
  @ApiProperty({
    required: true,
    type: () => MetadatFetchJobUpdate,
  })
  job: MetadatFetchJobUpdate;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: true,
  })
  publishNotification?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
  })
  bypassCache?: boolean;
}

export class UpdateMetadataFetchJobResponse {
  @ApiProperty({
    required: true,
    type: () => MetadataFetchJob,
  })
  job: MetadataFetchJob;
}

export interface Series {
  name: string;
  data: number[];
  type?: string;
}

export class GetMetadataFetchJobStatusStatisticsResponse {
  status: {
    categories: string[];
    series: Record<MetadataFetchJobStatus, number[]>;
  };
  expiration: {
    series: Series[];
  };
}

export class ListMetadataFetchJobsResponse extends PaginatedResults {
  @ApiProperty({ required: true, type: () => MetadataFetchJob, isArray: true })
  jobs: MetadataFetchJob[];
}
