import {
  type BaseMediaAssetSearchConfiguration,
  client,
  createMediaAssetSearchConfiguration,
  describeMediaAssetSearchConfiguration, type FilterDefinition, listMediaAssetSearchExecutions,
  listMediaAssetSearchResults,
  type MediaAssetSearchType,
  type PartialMediaAssetSearchConfiguration, triggerMediaAssetSearch,
  updateMediaAssetSearchConfiguration,
} from "@ncfritz/olympus-sdk/dionysus";
import { ApiBase } from "./apiBase";
import type {SortOptions} from "./common";

class MediaApi extends ApiBase {
  constructor() {
    super();

    client.setConfig({
      baseURL: "/api/v1",
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

  async updateMediaAssetSearchConfiguration(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    searchConfiguration: PartialMediaAssetSearchConfiguration,
    recursive: boolean = false,
  ) {
    return await updateMediaAssetSearchConfiguration({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
      },
      query: {
        recursive: recursive,
      },
      body: {
        searchConfiguration: searchConfiguration,
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

  async listMediaAssetSearchExecutions(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    page: number = 0,
    pageSize: number = 30,
    sort: SortOptions = { field: "startedTime", order: "desc" },
    filters?: FilterDefinition,
  ) {
    return await listMediaAssetSearchExecutions({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
      },
      query: {
        pageSize: pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async listMediaAssetSearchResults(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    page: number = 0,
    pageSize: number = 100,
    sort: SortOptions = { field: "postedTime", order: "desc" },
    filters?: FilterDefinition,
  ) {
    return await listMediaAssetSearchResults({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
      },
      query: {
        pageSize: pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async triggerMediaAssetSearch(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ) {
    return await triggerMediaAssetSearch({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
      },
    });
  }
}

const contentApi = new MediaApi();
export default contentApi;
