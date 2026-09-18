/** Hasura rows for Dionysus tables, as the API's queries receive them. */
import {
  JobStatus,
  JobType,
  MetadataFetchJobStatus,
  MetadataJobType,
  WorkflowStatus,
  WorkflowStepType,
} from "@ncfritz/olympus-model";
import type {
  GraphQlBatchJob,
  GraphQlMetadataFetchJob,
} from "../../src/types/batchJobs";
import type {
  GraphQLWorkflow,
  GraphQlWorkflowStep,
} from "../../src/types/workflow";
import { base64Json } from "./olympus";

export const BATCH_JOB_ID = "6b1f0a52-0000-4000-8000-00000000b001";

export const graphQlBatchJob = (
  overrides: Partial<GraphQlBatchJob> = {},
): GraphQlBatchJob => ({
  id: BATCH_JOB_ID,
  type: JobType.MOVIES,
  status: JobStatus.CREATED,
  createdTime: "2026-09-18T10:00:00Z",
  lastUpdatedTime: "2026-09-18T10:05:00Z",
  startedTime: "2026-09-18T10:01:00Z",
  finishedTime: "",
  totalRecords: 100,
  processedRecords: 40,
  duplicateRecords: 1,
  noOpRecords: 2,
  newRecords: 30,
  expiredRecords: 5,
  skippedRecords: 2,
  ...overrides,
});

export const graphQlMetadataFetchJob = (
  overrides: Partial<GraphQlMetadataFetchJob> = {},
): GraphQlMetadataFetchJob => ({
  id: "603",
  type: MetadataJobType.MOVIES,
  status: MetadataFetchJobStatus.QUEUED,
  createdTime: "2026-09-01T00:00:00Z",
  lastUpdatedTime: "2026-09-18T00:00:00Z",
  lastFetchedTime: "2026-09-10T00:00:00Z",
  ttl: 30,
  jitter: 120,
  context: base64Json({ source: "tmdb" }),
  ...overrides,
});

export const aggregate = (count: number) => ({ aggregate: { count } });

export const WORKFLOW_ID = "0f3c9e6a-0000-4000-8000-00000000f001";
export const STEP_ID = "0f3c9e6a-0000-4000-8000-00000000f101";

export const graphQlWorkflowStep = (
  overrides: Partial<GraphQlWorkflowStep> = {},
): GraphQlWorkflowStep => ({
  id: STEP_ID,
  type: WorkflowStepType.JOB_EXECUTION,
  attempt: 1,
  createdTime: "2026-09-18T10:00:00Z",
  lastUpdatedTime: "2026-09-18T10:00:00Z",
  job: graphQlBatchJob(),
  ...overrides,
});

export const graphQlWorkflow = (
  overrides: Partial<GraphQLWorkflow> = {},
): GraphQLWorkflow => ({
  id: WORKFLOW_ID,
  status: WorkflowStatus.STARTED,
  createdTime: "2026-09-18T09:00:00Z",
  lastUpdatedTime: "2026-09-18T10:00:00Z",
  startedTime: "2026-09-18T09:00:05Z",
  finishedTime: "",
  steps: [graphQlWorkflowStep()],
  ...overrides,
});
