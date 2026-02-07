import { MetadataFetchJobStatus } from "@ncfritz/olympus-sdk/dionysus";

export const IS_PROD = process.env.NODE_ENV === "production";

export const BATCH_JOB_PREFIX = "batchJob";
export const METADATA_JOB_PREFIX = "metadataJob";
export const JOB_TYPE_PREFIX = "jobType";
export const TRIGGER_SUFFIX = "trigger";
export const WORKFLOW_SUFFIX = "workflow";

export const BATCH_JOB_TRIGGER_EXCHANGE = `${BATCH_JOB_PREFIX}.${TRIGGER_SUFFIX}`;
export const BATCH_JOB_WORKFLOW_EXCHANGE = `${BATCH_JOB_PREFIX}.${WORKFLOW_SUFFIX}`;
export const METADATA_JOB_TRIGGER_EXCHANGE = `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`;

export const TERMINAL_STATUSES: MetadataFetchJobStatus[] = [
  "failed",
  "invalidated",
  "fetched",
  "cancelled",
];

export const MOVIE_ID_TYPES = {
  imdb_id: "imdb",
  freebase_mid: "freebase_m",
  freebase_id: "freebase",
  tvrage_id: "tvrage",
  wikidata_id: "wikidata",
  facebook_id: "facebook",
  instagram_id: "instagram",
  twitter_id: "twitter",
  tiktok_id: "tiktok",
  youtube_id: "youtube",
};

export const PEOPLE_ID_TYPES = {
  imdb_id: "imdb",
  wikidata_id: "wikidata",
  facebook_id: "facebook",
  instagram_id: "instagram",
  twitter_id: "twitter",
};

export const TV_SERIES_ID_TYPES = {
  imdb_id: "imdb",
  freebase_mid: "freebase_m",
  freebase_id: "freebase",
  tvdb_id: "tvdb",
  tvrage_id: "tvrage",
  wikidata_id: "wikidata",
  facebook_id: "facebook",
  instagram_id: "instagram",
  twitter_id: "twitter",
};

export const TV_SEASON_ID_TYPES = {
  imdb_id: "imdb",
  freebase_mid: "freebase_m",
  freebase_id: "freebase",
  tvdb_id: "tvdb",
  tvrage_id: "tvrage",
  wikidata_id: "wikidata",
};

export const TV_EPISODE_ID_TYPES = {
  imdb_id: "imdb",
  freebase_mid: "freebase_m",
  freebase_id: "freebase",
  tvdb_id: "tvdb",
  tvrage_id: "tvrage",
  wikidata_id: "wikidata",
};
