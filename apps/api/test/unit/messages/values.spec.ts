import {
  ContentJobType,
  JobStatus,
  JobType,
  MediaAssetSearchType,
  MetadataFetchJobStatus,
  MetadataJobType,
} from "@ncfritz/olympus-model";
import {
  CONTENT_JOB_TYPES,
  JOB_STATUSES,
  JOB_TYPES,
  MEDIA_ASSET_TYPES,
  METADATA_FETCH_JOB_STATUSES,
  METADATA_JOB_TYPES,
} from "@ncfritz/olympus-messages";
import { describe, expect, it } from "vitest";

/**
 * The message contracts use string unions so agents don't depend on the
 * model; they must list exactly the model's enum values.
 */
describe("message value lists match the model enums", () => {
  it.each([
    ["JobType", JobType, JOB_TYPES],
    ["MetadataJobType", MetadataJobType, METADATA_JOB_TYPES],
    ["JobStatus", JobStatus, JOB_STATUSES],
    [
      "MetadataFetchJobStatus",
      MetadataFetchJobStatus,
      METADATA_FETCH_JOB_STATUSES,
    ],
    ["ContentJobType", ContentJobType, CONTENT_JOB_TYPES],
    ["MediaAssetSearchType", MediaAssetSearchType, MEDIA_ASSET_TYPES],
  ])("%s", (_name, modelEnum, values) => {
    expect([...values].sort()).toEqual(Object.values(modelEnum).sort());
  });
});
