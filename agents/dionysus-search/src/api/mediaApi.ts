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
  updateMediaAssetDownload,
  PartialMediaAssetDownload,
  bulkUpdateMediaAssetDownloads,
  MediaAssetDownloadStatusUpdate,
  updateMediaAssetDownloadByNzbId,
  SearchResultStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { ApiBase, BASE_URL } from "./apiBase";

class MediaApi extends ApiBase {
  constructor() {
    super();

    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
    });
  }

  async bulkUpdateMediaAssetDownloads(
    updates: MediaAssetDownloadStatusUpdate[],
  ) {
    return await bulkUpdateMediaAssetDownloads({
      body: {
        updates: updates,
      },
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

  async updateMediaAssetDownload(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    resultId: string,
    downloadId: string,
    download: PartialMediaAssetDownload,
  ) {
    return await updateMediaAssetDownload({
      path: {
        mediaType: mediaType,
        mediaId: mediaId,
        resultId: resultId,
        downloadId: downloadId,
      },
      body: {
        download: download,
      },
    });
  }

  async updateMediaAssetDownloadByNzbId(
    nzbId: number,
    download: PartialMediaAssetDownload,
    searchResultStatus: SearchResultStatus,
  ) {
    return await updateMediaAssetDownloadByNzbId({
      path: {
        nzbId: nzbId,
      },
      body: {
        download: download,
        searchResultStatus: searchResultStatus,
      },
      validateStatus: (status) => {
        return status === 200 || status === 404;
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
