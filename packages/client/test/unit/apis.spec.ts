import { describe, expect, it } from "vitest";
import { JobApi, OLYMPUS_APIS } from "../../src";
import { fakeApi } from "../support/fakeApi";

/**
 * Every wrapper method is named after the operation it calls (the SDK
 * function's name: the operationId in camel case, so CreateTVSeries is
 * createTvSeries), and calls exactly that operation: the
 * method, path and API are checked through the operation it is recorded
 * as. Arguments are placeholders; the SDK's types check the rest.
 */
const ARGS: Record<string, unknown[]> = {
  // ContentApi
  createContentAsset: [{}],
  addContentAssetTagToAsset: ["asset-1", { name: "hls", type: "system" }],
  listDuplicateContentAssets: ["sha"],
  describeContentIngestionWorkflow: ["wf-1"],
  updateContentIngestionWorkflow: ["wf-1", {}],
  createContentIngestionWorkflowStep: ["wf-1", "ingest"],
  updateContentIngestionWorkflowStep: ["wf-1", "step-1", {}],
  // JobApi
  describeBatchJob: ["job-1"],
  createBatchJob: ["movies", false],
  updateBatchJob: ["job-1", {}],
  describeMetadataFetchJob: ["603", "movies"],
  createMetadataFetchJob: [{ id: "603", type: "movies" }],
  updateMetadataFetchJob: ["603", "movies", {}, false, false],
  scrollMetadataFetchJobs: ["movies", "fetched"],
  // MediaApi
  createMediaAsset: [{}],
  bulkUpdateMediaAssetDownloads: [[]],
  updateMediaAssetDownload: ["movie", 603, "result-1", "download-1", {}],
  updateMediaAssetDownloadByNzbId: [7, {}, "downloading"],
  describeMediaAssetWorkflow: ["wf-1"],
  updateMediaAssetWorkflow: ["wf-1", {}],
  deleteMediaAssetWorkflow: ["wf-1"],
  createMediaAssetWorkflowStep: ["wf-1", "transcode"],
  describeMediaAssetWorkflowStep: ["wf-1", "step-1"],
  updateMediaAssetWorkflowStep: ["wf-1", "step-1", {}],
  createMediaAssetWorkflowSubStep: ["wf-1", "step-1", "sha"],
  approveMediaAssetTranscodeConfiguration: ["wf-1", "step-1", {}],
  verifyMediaAssetTranscodeConfiguration: ["wf-1", "step-1"],
  // MediaSearchApi
  createMediaAssetSearchConfiguration: [{}],
  describeMediaAssetSearchConfiguration: ["movie", 603],
  listMediaAssetSearchConfigurations: [0, 30, undefined, { status: ["x"] }],
  getMediaAssetSearchConfigurationsRunningCount: ["tv_series", 1, 2],
  updateMediaAssetSearchConfiguration: ["movie", 603, {}],
  createMediaAssetSearchExecution: ["movie", 603],
  updateMediaAssetSearchExecution: ["movie", 603, "execution-1", {}],
  createMediaAssetSearchResult: ["movie", 603, {}],
  describeMediaAssetSearchResult: ["movie", 603, "result-1"],
  // MetadataApi
  describeMovie: [603],
  createMovie: [{}],
  describeTvSeries: [1],
  createTvSeries: [{}],
  describeTvSeason: [1, 2],
  createTvSeriesSeason: [1, {}],
  describeTvEpisode: [1, 2, 3],
  getTvEpisodeById: [4],
  createTvSeriesEpisode: [1, 2, {}],
  createPerson: [{}],
  createCertification: [{}],
  createCollection: [{}],
  createCountry: [{}],
  createGenre: [{}],
  createKeyword: [{}],
  createLanguage: [{}],
  createNetwork: [{}],
  createProductionCompany: [{}],
  // MetadataWorkflowApi
  describeMetadataWorkflow: ["wf-1"],
  updateMetadataWorkflow: ["wf-1", {}],
  listMetadataWorkflowSteps: ["wf-1"],
  createMetadataWorkflowStep: ["wf-1", {}],
  // NotificationApi
  sendNotification: [{}],
  createNotification: [{}],
};

const methods = OLYMPUS_APIS.flatMap((api) =>
  Object.getOwnPropertyNames(api.prototype)
    .filter((name) => name !== "constructor")
    .map((name) => [api.name, name, api] as const),
);

describe("the wrappers", () => {
  it("have placeholder arguments for every method", () => {
    expect(methods.map(([, name]) => name).sort()).toEqual(
      Object.keys(ARGS).sort(),
    );
  });

  it.each(methods)(
    "%s.%s calls the operation it is named after",
    async (_, name, Api) => {
      const api = fakeApi();
      const wrapper = new Api(api.clients) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;

      await wrapper[name](...ARGS[name]);

      expect(api.observed).toHaveLength(1);
      expect(api.observed[0].operation.toLowerCase()).toBe(name.toLowerCase());
    },
  );

  it("encodes list filters as base64 JSON", async () => {
    const api = fakeApi();
    await new JobApi(api.clients).scrollMetadataFetchJobs(
      "movies",
      "fetched",
      "x",
    );
    const url = new URL(api.sent[0].url);
    expect(JSON.parse(atob(url.searchParams.get("filters")!))).toEqual({
      type: ["movies"],
      status: ["fetched"],
    });
    expect(url.searchParams.get("lastSeenId")).toBe("x");
  });
});
