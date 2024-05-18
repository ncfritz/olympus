import {
  CertificationType,
  GenreType,
  JobStatus,
  JobType,
  MetadataFetchJobStatus,
  MetadataJobType,
} from "@ncfritz/olympus-model";

export type GraphQlBatchJob = {
  id: string;
  type: JobType;
  status: JobStatus;
  createdTime: string;
  lastUpdatedTime: string;
  startedTime: string;
  finishedTime: string;
  totalRecords: number;
  duplicateRecords: number;
  noOpRecords: number;
  newRecords: number;
  expiredRecords: number;
  skippedRecords: number;
  processedRecords: number;
};

export type GraphQlListBatchJobsResponse = {
  dionysus_bulk_load_jobs: GraphQlBatchJob[];
};

export type GraphQlCertification = {
  certification: string;
  country: string;
  createdTime: string;
  lastUpdatedTime: string;
  meaning: string;
  order: number;
  type: CertificationType;
};

export type GraphQlCountry = {
  createdTime: string;
  id: string;
  lastUpdatedTime: string;
  name: string;
};

export type GraphQlGenre = {
  id: number;
  type: GenreType;
  name: string;
  createdTime: string;
  lastUpdatedTime: string;
};

export type GraphQlKeyword = {
  id: string;
  value: string;
  createdTime: string;
  lastUpdatedTime: string;
};

export type GraphQlLanguage = {
  id: string;
  name: string;
  nativeName: string;
  createdTime: string;
  lastUpdatedTime: string;
};

export type GraphQlMetadataFetchJob = {
  createdTime: string;
  id: string;
  jitter: number;
  lastFetchedTime: string;
  lastUpdatedTime: string;
  status: MetadataFetchJobStatus;
  ttl: number;
  type: MetadataJobType;
};

export type GraphQlBulkLoadJobStat = {
  count: number;
  created_date: string;
  duplicate_records: number;
  expired_records: number;
  new_records: number;
  noop_records: number;
  processed_records: number;
  queue_time: number;
  run_time: number;
  skipped_records: number;
  total_records: number;
  type: MetadataJobType;
};

export type GraphQlBulkLoadJobStatusStat = {
  count: number;
  status: JobStatus;
  type: MetadataJobType;
};