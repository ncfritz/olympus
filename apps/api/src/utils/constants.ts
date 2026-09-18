import { JobStatus, MetadataJobType } from "@ncfritz/olympus-model";

export const IS_PROD = process.env.NODE_ENV === "production";

export const METADATA_CATEGORY_MAP = {
  [MetadataJobType.MOVIES]: "Movies",
  [MetadataJobType.TV_SERIES]: "TV Series",
  [MetadataJobType.TV_SEASONS]: "TV Seasons",
  [MetadataJobType.TV_EPISODES]: "TV Episodes",
  [MetadataJobType.PEOPLE]: "People",
  [MetadataJobType.COLLECTIONS]: "Collections",
  [MetadataJobType.TV_NETWORKS]: "TV Networks",
  [MetadataJobType.KEYWORDS]: "Keywords",
  [MetadataJobType.PRODUCTION_COMPANIES]: "Production Companies",
  [MetadataJobType.CERTIFICATIONS]: "Certifications",
  [MetadataJobType.GENRES]: "Genres",
  [MetadataJobType.COUNTRIES]: "Countries",
  [MetadataJobType.LANGUAGES]: "Languages",
};

export const BATCH_JOB_STATUSES_MAP = {
  [JobStatus.CREATED]: "Created",
  [JobStatus.STARTED]: "Started",
  [JobStatus.SUCCESS]: "Success",
  [JobStatus.CANCELLED]: "Cancelled",
  [JobStatus.FAILED]: "Failed",
};
