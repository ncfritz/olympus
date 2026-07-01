import {
  approveMediaAssetTranscodeConfiguration,
  type ApproveMediaAssetTranscodeConfigurationRequest,
  type BaseMediaAssetSearchConfiguration,
  client,
  createMediaAssetDownload,
  createMediaAssetSearchConfiguration,
  createMediaAssetWorkflow,
  createMediaFavorite,
  deleteMediaFavorite,
  describeMediaAssetSearchConfiguration,
  describeMediaAssetWorkflow,
  type FilterDefinition,
  listMediaAssetDownloads,
  listMediaAssetSearchConfigurations,
  listMediaAssetSearchExecutions,
  listMediaAssetSearchResults,
  listMediaAssetTranscodes,
  listMediaAssetWorkflows,
  type MediaAssetSearchType,
  type PartialMediaAssetSearchConfiguration,
  triggerMediaAssetSearch,
  updateMediaAssetSearchConfiguration,
  verifyMediaAssetTranscodeConfiguration,
} from "@ncfritz/olympus-sdk/dionysus";
import { ApiBase } from "./apiBase";
import type { SortOptions } from "./common";

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

  async createMediaAssetDownload(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    searchResultId: string,
  ) {
    return await createMediaAssetDownload({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
        resultId: searchResultId,
      },
    });
  }

  async createMediaAssetWorkflow(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    searchResultId: string,
  ) {
    return await createMediaAssetWorkflow({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
        resultId: searchResultId,
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

  async describeMediaAssetWorkflow(workflowId: string) {
    return await describeMediaAssetWorkflow({
      path: {
        workflowId: workflowId,
      },
      validateStatus: (status) => {
        return status === 200 || status === 404;
      },
    });
  }

  async listMediaAssetDownloads(
    page: number = 0,
    pageSize: number = 30,
    sort: SortOptions = { field: "startedTime", order: "desc" },
    filters?: FilterDefinition,
  ) {
    return await listMediaAssetDownloads({
      query: {
        pageSize: pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async listMediaAssetTranscodes(
    page: number = 0,
    pageSize: number = 30,
    sort: SortOptions = { field: "startedTime", order: "desc" },
    filters?: FilterDefinition,
  ) {
    return await listMediaAssetTranscodes({
      query: {
        pageSize: pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async listMediaAssetSearchConfigurations(
    page: number = 0,
    pageSize: number = 30,
    sort: SortOptions = { field: "lastExecutionTime", order: "desc" },
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

  async listMediaAssetWorkflows(
    page: number = 0,
    pageSize: number = 30,
    sort: SortOptions = { field: "startedTime", order: "desc" },
    filters?: FilterDefinition,
  ) {
    return await listMediaAssetWorkflows({
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

  async approveMediaAssetTranscodeConfiguration(
    workflowId: string,
    workflowStepId: string,
    request: ApproveMediaAssetTranscodeConfigurationRequest,
  ) {
    return await approveMediaAssetTranscodeConfiguration({
      path: {
        workflowId: workflowId,
        workflowStepId: workflowStepId,
      },
      body: request,
    });
  }

  async verifyMediaAssetTranscodeConfiguration(
    workflowId: string,
    workflowStepId: string,
  ) {
    return await verifyMediaAssetTranscodeConfiguration({
      path: {
        workflowId: workflowId,
        workflowStepId: workflowStepId,
      },
    });
  }

  async createMediaFavorite(mediaType: MediaAssetSearchType, mediaId: number) {
    return await createMediaFavorite({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
      },
    });
  }

  async deleteMediaFavorite(mediaType: MediaAssetSearchType, mediaId: number) {
    return await deleteMediaFavorite({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
      },
      validateStatus: (status) => {
        return status === 200 || status == 410;
      },
    });
  }
}

const contentApi = new MediaApi();
export default contentApi;
