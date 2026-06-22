import {
  type BaseMediaAssetSearchConfiguration,
  PartialMediaAssetSearchResult,
  client,
  createMediaAssetSearchConfiguration,
  createMediaAssetSearchResult,
  createMediaAssetSearchExecution,
  describeMediaAssetSearchConfiguration,
  getMediaAssetSearchConfigurationsRunningCount,
  type MediaAssetSearchType,
  type PartialMediaAssetSearchConfiguration,
  PartialMediaAssetSearchExecution,
  updateMediaAssetSearchConfiguration,
  updateMediaAssetSearchExecution,
  describeMediaAssetSearchResult,
  listMediaAssetSearchConfigurations,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import { SortOptions } from "../types/common";
import { ApiBase, BASE_URL } from "./apiBase";

class MediaApi extends ApiBase {
  constructor() {
    super();

    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
    });
  }

  async createMediaAssetSearchConfiguration(
    searchConfiguration: BaseMediaAssetSearchConfiguration,
  ) {
    return await createMediaAssetSearchConfiguration({
      body: {
        searchConfiguration: searchConfiguration,
      },
    });
  }

  async createMediaAssetSearchExecution(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ) {
    return await createMediaAssetSearchExecution({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
      },
      body: {},
    });
  }

  async createMediaAssetSearchResult(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    searchResult: PartialMediaAssetSearchResult,
  ) {
    return await createMediaAssetSearchResult({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
      },
      body: {
        searchResult: searchResult,
      },
    });
  }

  async describeMediaAssetSearchConfiguration(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ) {
    return await describeMediaAssetSearchConfiguration({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
      },
      validateStatus: (status) => {
        return status === 200 || status === 404;
      },
    });
  }

  async describeMediaAssetSearchResult(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    guid: string,
  ) {
    return await describeMediaAssetSearchResult({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
        resultId: guid,
      },
      validateStatus: (status) => {
        return status === 200 || status === 404;
      },
    });
  }

  async getMediaAssetSearchConfigurationsRunningCount(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    seasonNumber: number | undefined = undefined,
  ) {
    return await getMediaAssetSearchConfigurationsRunningCount({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
      },
      query: {
        seasonNumber: seasonNumber,
      },
    });
  }

  async listMediaAssetSearchConfigurations(
    page: number = 0,
    pageSize: number = 30,
    sort: SortOptions = { field: "startedTime", order: "desc" },
    filters?: FilterDefinition,
  ) {
    return await listMediaAssetSearchConfigurations({
      query: {
        pageSize: pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async updateMediaAssetSearchConfiguration(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    searchConfiguration: PartialMediaAssetSearchConfiguration,
  ) {
    return await updateMediaAssetSearchConfiguration({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
      },
      body: {
        searchConfiguration: searchConfiguration,
      },
    });
  }

  async updateMediaAssetSearchExecution(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    executionId: string,
    searchExecution: PartialMediaAssetSearchExecution,
  ) {
    return await updateMediaAssetSearchExecution({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
        executionId: executionId,
      },
      body: {
        searchExecution: searchExecution,
      },
    });
  }
}

const contentApi = new MediaApi();
export default contentApi;
