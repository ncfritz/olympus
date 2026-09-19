/** Hasura rows for Dionysus media tables. */
import {
  MediaAssetSearchConfigurationStatus,
  MediaAssetSearchType,
  MediaAssetWorkflowStatus,
  MediaAssetWorkflowStepStatus,
  MediaAssetWorkflowStepType,
  MediaDownloadStatus,
  PasswordType,
  SearchExecutionStatus,
  SearchResultStatus,
} from "@ncfritz/olympus-model";
import type { GraphQlMediaAsset } from "../../src/dionysus/media/assets/types/mediaAsset";
import type {
  GraphQlDecoratedMediaAssetWorkflow,
  GraphQlDecoratedMediaAssetWorkflowStep,
  GraphQlMediaAssetWorkflowDecoration,
} from "../../src/dionysus/media/workflows/types/mediaAssetWorkflow";
import type {
  GraphQlDecoratedMediaAssetDownload,
  GraphQlMediaAssetDownload,
} from "../../src/dionysus/media/downloads/types/mediaDownload";
import type { GraphQlMediaFavorite } from "../../src/dionysus/media/favorites/types/mediaFavorite";
import type {
  GraphQlDecoratedMediaAssetSearchConfiguration,
  GraphQlDecoratedMediaAssetSearchConfigurationListItem,
} from "../../src/dionysus/media/searchConfigurations/types/searchConfiguration";
import type { GraphQlMediaAssetSearchExecution } from "../../src/dionysus/media/searchExecutions/types/searchExecution";
import type { GraphQlMediaAssetSearchResult } from "../../src/dionysus/media/searchResults/types/searchResult";

export const MOVIE_ID = 603;
export const RESULT_ID = "nzb-603-1080p";
export const EXECUTION_ID = "5e1d6f7a-0000-4000-8000-00000000e001";
export const DOWNLOAD_ID = "5e1d6f7a-0000-4000-8000-00000000d001";
export const MEDIA_WORKFLOW_ID = "5e1d6f7a-0000-4000-8000-00000000a001";
export const MEDIA_STEP_ID = "5e1d6f7a-0000-4000-8000-00000000a101";

const times = {
  createdTime: "2026-09-18T10:00:00Z",
  lastUpdatedTime: "2026-09-18T10:05:00Z",
};

export const decoration = (
  overrides: Partial<GraphQlMediaAssetWorkflowDecoration> = {},
): GraphQlMediaAssetWorkflowDecoration => ({
  name: "The Matrix",
  posterPath: "/matrix.jpg",
  ...overrides,
});

export const graphQlSearchConfiguration = (
  overrides: Partial<GraphQlDecoratedMediaAssetSearchConfiguration> = {},
): GraphQlDecoratedMediaAssetSearchConfiguration => ({
  assetType: MediaAssetSearchType.MOVIE,
  mediaId: MOVIE_ID,
  enabled: true,
  status: MediaAssetSearchConfigurationStatus.OK,
  backoff: 60,
  jitter: 30,
  lastExecutionTime: "2026-09-17T00:00:00Z",
  nextExecutionTime: "2026-09-19T00:00:00Z",
  decoration: decoration(),
  ...times,
  ...overrides,
});

export const graphQlSearchExecution = (
  overrides: Partial<GraphQlMediaAssetSearchExecution> = {},
): GraphQlMediaAssetSearchExecution => ({
  id: EXECUTION_ID,
  status: SearchExecutionStatus.SUCCESS,
  searchType: MediaAssetSearchType.MOVIE,
  mediaId: MOVIE_ID,
  newRecords: 3,
  duplicateRecords: 1,
  skippedRecords: 0,
  totalRecords: 4,
  startedTime: "2026-09-18T10:00:00Z",
  finishedTime: "2026-09-18T10:01:00Z",
  ...times,
  ...overrides,
});

export const graphQlSearchConfigurationListItem = (
  overrides: Partial<GraphQlDecoratedMediaAssetSearchConfigurationListItem> = {},
): GraphQlDecoratedMediaAssetSearchConfigurationListItem => ({
  ...graphQlSearchConfiguration(),
  searchExecutions: [graphQlSearchExecution()],
  ...overrides,
});

export const graphQlDownload = (
  overrides: Partial<GraphQlMediaAssetDownload> = {},
): GraphQlMediaAssetDownload => ({
  id: DOWNLOAD_ID,
  nzbId: 42,
  assetType: MediaAssetSearchType.MOVIE,
  mediaId: MOVIE_ID,
  workflowId: MEDIA_WORKFLOW_ID,
  searchResultId: RESULT_ID,
  status: MediaDownloadStatus.DOWNLOADING,
  progress: 40,
  startedTime: "2026-09-18T10:00:00Z",
  finishedTime: "",
  ...times,
  ...overrides,
});

export const graphQlDecoratedDownload = (
  overrides: Partial<GraphQlDecoratedMediaAssetDownload> = {},
): GraphQlDecoratedMediaAssetDownload => ({
  ...graphQlDownload(),
  decoration: decoration(),
  ...overrides,
});

export const graphQlSearchResult = (
  overrides: Partial<GraphQlMediaAssetSearchResult> = {},
): GraphQlMediaAssetSearchResult => ({
  id: RESULT_ID,
  assetType: MediaAssetSearchType.MOVIE,
  mediaId: MOVIE_ID,
  title: "The.Matrix.1999.1080p.BluRay",
  status: SearchResultStatus.NONE,
  score: 87,
  size: 8_000_000_000,
  password: PasswordType.NONE,
  quality: "Bluray-1080p",
  qualityGroup: "HD",
  source: 7,
  modifier: 0,
  resolution: 1080,
  repack: false,
  postedTime: "2026-09-10T00:00:00Z",
  createdTime: "2026-09-18T10:00:00Z",
  tags: [],
  downloads: [],
  ...overrides,
});

export const graphQlMediaWorkflowStep = (
  overrides: Partial<GraphQlDecoratedMediaAssetWorkflowStep> = {},
): GraphQlDecoratedMediaAssetWorkflowStep => ({
  id: MEDIA_STEP_ID,
  type: MediaAssetWorkflowStepType.TRANSCODE,
  assetType: MediaAssetSearchType.MOVIE,
  mediaId: MOVIE_ID,
  status: MediaAssetWorkflowStepStatus.RUNNING,
  progress: 25,
  startedTime: "2026-09-18T10:00:00Z",
  finishedTime: "",
  subSteps: [],
  decoration: decoration(),
  ...times,
  ...overrides,
});

export const graphQlMediaWorkflow = (
  overrides: Partial<GraphQlDecoratedMediaAssetWorkflow> = {},
): GraphQlDecoratedMediaAssetWorkflow => ({
  id: MEDIA_WORKFLOW_ID,
  type: MediaAssetSearchType.MOVIE,
  mediaId: MOVIE_ID,
  tempLocation: "/tmp/603",
  status: MediaAssetWorkflowStatus.RUNNING,
  startedTime: "2026-09-18T10:00:00Z",
  finishedTime: "",
  download: graphQlDownload(),
  steps: [graphQlMediaWorkflowStep()],
  decoration: decoration(),
  ...times,
  ...overrides,
});

export const graphQlFavorite = (
  overrides: Partial<GraphQlMediaFavorite> = {},
): GraphQlMediaFavorite => ({
  createdTime: "2026-09-18T10:00:00Z",
  decoration: decoration(),
  ...overrides,
});

export const graphQlMediaAsset = (
  overrides: Partial<GraphQlMediaAsset> = {},
): GraphQlMediaAsset => ({
  type: MediaAssetSearchType.MOVIE,
  mediaId: MOVIE_ID,
  filePath: "/media/movies/The Matrix (1999).mkv",
  assetSha: "abc123",
  originalSizeBytes: 8_000_000_000,
  newSizeBytes: 4_000_000_000,
  durationMs: 8_160_000,
  width: 1920,
  height: 1080,
  ...times,
  ...overrides,
});
