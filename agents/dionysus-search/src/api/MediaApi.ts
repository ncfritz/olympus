import {
  type BaseMediaAssetSearchConfiguration,
  createMediaAssetSearchConfiguration,
  createMediaAssetSearchExecution,
  createMediaAssetSearchResult,
  describeMediaAssetSearchConfiguration,
  describeMediaAssetSearchResult,
  type FilterDefinition,
  getMediaAssetSearchConfigurationsRunningCount,
  listMediaAssetSearchConfigurations,
  type MediaAssetSearchConfiguration,
  type MediaAssetSearchResult,
  type MediaAssetSearchType,
  type PartialMediaAssetSearchConfiguration,
  type PartialMediaAssetSearchExecution,
  type PartialMediaAssetSearchResult,
  updateMediaAssetSearchConfiguration,
  updateMediaAssetSearchExecution,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { SortOptions } from "./SortOptions";

/** A 404 is an answer ("none"), not an error. */
const okOrNotFound = (status: number) => status === 200 || status === 404;

/** Dionysus media asset searches, through the SDK. */
@Injectable()
export class MediaApi {
  async createMediaAssetSearchConfiguration(
    searchConfiguration: BaseMediaAssetSearchConfiguration,
  ) {
    const response = await createMediaAssetSearchConfiguration({
      body: { searchConfiguration },
    });
    return response.data.searchConfiguration;
  }

  async createMediaAssetSearchExecution(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ) {
    const response = await createMediaAssetSearchExecution({
      path: { mediaType, mediaId },
      body: {},
    });
    return response.data.searchExecution;
  }

  async createMediaAssetSearchResult(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    searchResult: PartialMediaAssetSearchResult,
  ) {
    const response = await createMediaAssetSearchResult({
      path: { mediaType, mediaId },
      body: { searchResult },
    });
    return response.data.searchResult;
  }

  /** The asset's search configuration; undefined when it has none. */
  async describeMediaAssetSearchConfiguration(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ): Promise<MediaAssetSearchConfiguration | undefined> {
    const response = await describeMediaAssetSearchConfiguration({
      path: { mediaType, mediaId },
      validateStatus: okOrNotFound,
    });
    return response.data.searchConfiguration;
  }

  /** A search result by indexer GUID; undefined when it is new. */
  async describeMediaAssetSearchResult(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    resultId: string,
  ): Promise<MediaAssetSearchResult | undefined> {
    const response = await describeMediaAssetSearchResult({
      path: { mediaType, mediaId, resultId },
      validateStatus: okOrNotFound,
    });
    return response.data.searchResult;
  }

  /** How many of a series' (or season's) search configurations are running. */
  async getMediaAssetSearchConfigurationsRunningCount(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    seasonNumber?: number,
  ) {
    const response = await getMediaAssetSearchConfigurationsRunningCount({
      path: { mediaType, mediaId },
      query: { seasonNumber },
    });
    return response.data.count;
  }

  async listMediaAssetSearchConfigurations(
    page: number = 0,
    pageSize: number = 30,
    sort: SortOptions = { field: "startedTime", order: "desc" },
    filters?: FilterDefinition,
  ) {
    const response = await listMediaAssetSearchConfigurations({
      query: {
        pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: filters
          ? Buffer.from(JSON.stringify(filters)).toString("base64")
          : undefined,
      },
    });
    return response.data.searchConfigurations;
  }

  async updateMediaAssetSearchConfiguration(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    searchConfiguration: PartialMediaAssetSearchConfiguration,
  ) {
    const response = await updateMediaAssetSearchConfiguration({
      path: { mediaType, mediaId },
      body: { searchConfiguration },
    });
    return response.data.searchConfiguration;
  }

  async updateMediaAssetSearchExecution(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    executionId: string,
    searchExecution: PartialMediaAssetSearchExecution,
  ) {
    const response = await updateMediaAssetSearchExecution({
      path: { mediaType, mediaId, executionId },
      body: { searchExecution },
    });
    return response.data.searchExecution;
  }
}
