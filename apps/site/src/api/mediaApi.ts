import {
  type BaseMediaAssetSearchConfiguration,
  client,
  createMediaAssetSearchConfiguration,
  describeMediaAssetSearchConfiguration,
  type MediaAssetSearchType,
  type PartialMediaAssetSearchConfiguration,
  updateMediaAssetSearchConfiguration,
} from "@ncfritz/olympus-sdk/dionysus";
import { ApiBase } from "./apiBase";

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
}

const contentApi = new MediaApi();
export default contentApi;
