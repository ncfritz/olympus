import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import moment, { Moment } from "moment";
import { PaginatedResults } from "../ModelCommon";

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

export class MetadataFetchJob {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ enum: MetadataJobType })
  type: MetadataJobType;

  @ApiProperty({ enum: MetadataFetchJobStatus })
  status: MetadataFetchJobStatus;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastFetchedTime?: Moment;

  @ApiProperty({ type: Number })
  ttl: number;

  @ApiProperty({ type: Number })
  jitter: number;
}

export class PartialMetadataFetchJob extends OmitType(MetadataFetchJob, [
  "id",
  "type",
  "createdTime",
  "lastUpdatedTime",
]) {}

export class CreateMetadataFetchJobRequest {
  @ApiProperty({
    type: Number,
    description: "The id of the TMDB entity to create a job for",
    required: true,
  })
  id: number;

  @ApiProperty({
    enum: MetadataJobType,
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
    enum: MetadataFetchJobStatus,
    description: "The initial status of the job",
    required: false,
    default: MetadataFetchJobStatus.QUEUED,
  })
  status: MetadataFetchJobStatus;

  @ApiProperty({ type: String, required: false, default: undefined })
  @Transform(({ value }) => (value ? moment(value) : undefined))
  lastFetchedTime?: Moment;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: true,
  })
  publishNotification?: boolean;
}

export class CreateMetadataFetchJobResponse {
  @ApiProperty({
    type: () => MetadataFetchJob,
  })
  job: MetadataFetchJob;
}

export class DescribeMetadataFetchJobResponse {
  @ApiProperty({
    type: () => MetadataFetchJob,
  })
  job: MetadataFetchJob;
}

export class DeleteMetadataFetchJobResponse {
  @ApiProperty({
    type: () => MetadataFetchJob,
  })
  job: MetadataFetchJob;
}

export class UpdateMetadataFetchJobRequest {
  @ApiProperty({
    type: () => PartialMetadataFetchJob,
  })
  job: PartialMetadataFetchJob;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: true,
  })
  publishNotification?: boolean;
}

export class UpdateMetadataFetchJobResponse {
  @ApiProperty({
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
  @ApiProperty({ type: () => MetadataFetchJob, isArray: true })
  jobs: MetadataFetchJob[];
}
