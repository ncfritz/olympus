import type { SortOptions } from "../api/common";

export enum JobStatus {
  CREATED = "created",
  STARTED = "started",
  CANCELLED = "cancelled",
  SUCCESS = "success",
  FAILED = "failed",
}

export enum JobType {
  ALL = "all",
  MOVIES = "movies",
  TV_SERIES = "tv_series",
  PEOPLE = "people",
  COLLECTIONS = "collections",
  TV_NETWORKS = "tv_networks",
  KEYWORDS = "keywords",
  PRODUCTION_COMPANIES = "production_companies",
  CERTIFICATIONS = "certifications",
  COUNTRIES = "countries",
  GENRES = "genres",
  LANGUAGES = "languages",
  REDRIVE = "redrive",
}

export interface BatchJobRecord {
  id: string;
  createdTime: string;
  lastUpdatedTime?: string;
  startedTime?: string;
  finishedTime?: string;
  totalRecords?: number;
  duplicateRecords?: number;
  noOpRecords?: number;
  newRecords?: number;
  expiredRecords?: number;
  processedRecords?: number;
  skippedRecords?: number;
  status: JobStatus;
}

export type PaginatedParams = {
  page: number;
  sort: SortOptions;
};
