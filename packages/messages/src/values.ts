/**
 * Enumerations carried in messages, as string unions (agents don't depend
 * on the model). The API's tests check they match the model's enums.
 */

export const JOB_TYPES = [
  "movies",
  "tv_series",
  "tv_seasons",
  "tv_episodes",
  "people",
  "collections",
  "tv_networks",
  "keywords",
  "production_companies",
  "certifications",
  "genres",
  "countries",
  "languages",
  "redrive",
] as const;
/** Batch job types (model JobType). */
export type JobType = (typeof JOB_TYPES)[number];

/** Metadata entity types (model MetadataJobType): every JobType but redrive. */
export type MetadataJobType = Exclude<JobType, "redrive">;
export const METADATA_JOB_TYPES = JOB_TYPES.filter(
  (type): type is MetadataJobType => type !== "redrive",
);

export const JOB_STATUSES = [
  "created",
  "started",
  "cancelled",
  "success",
  "failed",
] as const;
/** Batch job status (model JobStatus). */
export type JobStatus = (typeof JOB_STATUSES)[number];

export const METADATA_FETCH_JOB_STATUSES = [
  "queued",
  "invalidated",
  "fetching",
  "cancelled",
  "fetched",
  "failed",
  "not_found",
] as const;
/** Metadata fetch job status (model MetadataFetchJobStatus). */
export type MetadataFetchJobStatus =
  (typeof METADATA_FETCH_JOB_STATUSES)[number];

export const CONTENT_JOB_TYPES = ["hls", "thumbnail", "delete"] as const;
/** Content asset processing jobs (model ContentJobType). */
export type ContentJobType = (typeof CONTENT_JOB_TYPES)[number];

export const MEDIA_ASSET_TYPES = [
  "movie",
  "tv_series",
  "tv_season",
  "tv_episode",
] as const;
/** Searchable media (model MediaAssetSearchType). */
export type MediaAssetType = (typeof MEDIA_ASSET_TYPES)[number];
