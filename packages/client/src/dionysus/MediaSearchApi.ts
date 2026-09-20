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
import type { OlympusClients } from "../clients";
import { encodeFilters, okOrNotFound, type SortOptions } from "../filters";

/** Dionysus media asset searches: configurations, executions and results. */
export class MediaSearchApi {
  constructor(private readonly clients: OlympusClients) {}

  async createMediaAssetSearchConfiguration(
    searchConfiguration: BaseMediaAssetSearchConfiguration,
  ) {
    const response = await createMediaAssetSearchConfiguration({
      client: this.clients.dionysus,
      body: { searchConfiguration },
    });
    return response.data.searchConfiguration;
  }

  /** The asset's search configuration; undefined when it has none. */
  async describeMediaAssetSearchConfiguration(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ): Promise<MediaAssetSearchConfiguration | undefined> {
    const response = await describeMediaAssetSearchConfiguration({
      client: this.clients.dionysus,
      path: { mediaType, mediaId },
      validateStatus: okOrNotFound,
    });
    return response.status === 404
      ? undefined
      : response.data.searchConfiguration;
  }

  async listMediaAssetSearchConfigurations(
    page: number = 0,
    pageSize: number = 30,
    sort: SortOptions = { field: "startedTime", order: "desc" },
    filters?: FilterDefinition,
  ) {
    const response = await listMediaAssetSearchConfigurations({
      client: this.clients.dionysus,
      query: {
        pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: filters ? encodeFilters(filters) : undefined,
      },
    });
    return response.data.searchConfigurations;
  }

  /** How many of a series' (or season's) search configurations are running. */
  async getMediaAssetSearchConfigurationsRunningCount(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    seasonNumber?: number,
  ) {
    const response = await getMediaAssetSearchConfigurationsRunningCount({
      client: this.clients.dionysus,
      path: { mediaType, mediaId },
      query: { seasonNumber },
    });
    return response.data.count;
  }

  async updateMediaAssetSearchConfiguration(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    searchConfiguration: PartialMediaAssetSearchConfiguration,
  ) {
    const response = await updateMediaAssetSearchConfiguration({
      client: this.clients.dionysus,
      path: { mediaType, mediaId },
      body: { searchConfiguration },
    });
    return response.data.searchConfiguration;
  }

  async createMediaAssetSearchExecution(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ) {
    const response = await createMediaAssetSearchExecution({
      client: this.clients.dionysus,
      path: { mediaType, mediaId },
      body: {},
    });
    return response.data.searchExecution;
  }

  async updateMediaAssetSearchExecution(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    executionId: string,
    searchExecution: PartialMediaAssetSearchExecution,
  ) {
    const response = await updateMediaAssetSearchExecution({
      client: this.clients.dionysus,
      path: { mediaType, mediaId, executionId },
      body: { searchExecution },
    });
    return response.data.searchExecution;
  }

  async createMediaAssetSearchResult(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    searchResult: PartialMediaAssetSearchResult,
  ) {
    const response = await createMediaAssetSearchResult({
      client: this.clients.dionysus,
      path: { mediaType, mediaId },
      body: { searchResult },
    });
    return response.data.searchResult;
  }

  /** A search result by indexer GUID; undefined when it is new. */
  async describeMediaAssetSearchResult(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    resultId: string,
  ): Promise<MediaAssetSearchResult | undefined> {
    const response = await describeMediaAssetSearchResult({
      client: this.clients.dionysus,
      path: { mediaType, mediaId, resultId },
      validateStatus: okOrNotFound,
    });
    return response.status === 404 ? undefined : response.data.searchResult;
  }
}
