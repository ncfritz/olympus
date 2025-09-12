import {
  addContentAssetTagToAsset,
  checkAuthorization,
  client,
  type ContentAsset,
  type ContentAssetTag,
  type ContentJobType,
  type ContentTagType,
  createContentAssetTag,
  createContentJob,
  deleteContentAssetTagFromAsset,
  getContentAsset,
  getContentAssetAggregateStatistics,
  getContentAssetDurationStatistics,
  getContentAssetHeightStatistics,
  getContentAssetSizeStatistics,
  getContentAssetWidthStatistics,
  getUntaggedContentAsset,
  listAvailableContentAssetTags,
  listContentAssets,
  listContentAssetTagsForAsset,
  listSimilarContentAssets,
  verifyAuthCode,
} from "@ncfritz/olympus-sdk/dionysus";
import { store } from "../redux/store";
import type { SortOptions } from "./common";

class ContentApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  private buildHeaders(existing?: Record<string, string>) {
    return {
      headers: {
        ...existing,
        "x-dionysus-content-bc": `${store.getState().blackCurtain.active || true}`,
      },
    };
  }

  async listAssets(page: number, sort: SortOptions) {
    return await listContentAssets({
      query: {
        startPage: page,
        pageSize: 15,
        sortBy: sort.field,
        sort: sort.order,
      },
      ...this.buildHeaders(),
    });
  }

  async getAsset(assetId: string) {
    return await getContentAsset({
      path: {
        assetId: assetId,
      },
      ...this.buildHeaders(),
    });
  }

  async getUntaggedAsset() {
    return await getUntaggedContentAsset({ ...this.buildHeaders() });
  }

  async listSimilarAssets(asset: ContentAsset, tags: ContentAssetTag[]) {
    const tagTypes: string[] = [];
    const tagNames: string[] = [];

    tags.forEach((tag) => {
      tagTypes.push(tag.type);
      tagNames.push(tag.name);
    });

    return await listSimilarContentAssets({
      path: {
        assetId: asset.id,
      },
      query: {
        tagType: tagTypes,
        tagName: tagNames,
      },
      ...this.buildHeaders(),
    });
  }

  async listAssetTags(assetId: string) {
    return await listContentAssetTagsForAsset({
      params: {
        assetId: assetId,
      },
    });
  }

  async listAvailableTagsForAsset(assetId: string) {
    return await listAvailableContentAssetTags({
      params: {
        assetId: assetId,
      },
      ...this.buildHeaders(),
    });
  }

  async getAssetAggregateStatistics() {
    return await getContentAssetAggregateStatistics({ ...this.buildHeaders() });
  }

  async getAssetDurationStatistics() {
    return await getContentAssetDurationStatistics({ ...this.buildHeaders() });
  }

  async getAssetHeightStatistics() {
    return await getContentAssetHeightStatistics({ ...this.buildHeaders() });
  }

  async getAssetSizeStatistics() {
    return await getContentAssetSizeStatistics({ ...this.buildHeaders() });
  }

  async getAssetWidthStatistics() {
    return await getContentAssetWidthStatistics({ ...this.buildHeaders() });
  }

  async listTags() {
    return await listAvailableContentAssetTags({ ...this.buildHeaders() });
  }

  async addTagToAsset(assetId: string, type: ContentTagType, name: string) {
    await addContentAssetTagToAsset({
      path: {
        assetId: assetId,
      },
      body: {
        tag: {
          type: type,
          name: name,
        },
      },
      ...this.buildHeaders(),
    });
  }

  async createAssetTag(type: ContentTagType, name: string) {
    return await createContentAssetTag({
      body: {
        tag: {
          type: type,
          name: name,
        },
      },
      ...this.buildHeaders(),
    });
  }

  async removeTagFromAsset(assetId: string, tagId: string) {
    return await deleteContentAssetTagFromAsset({
      path: {
        assetId: assetId,
        tagId: tagId,
      },
      ...this.buildHeaders(),
    });
  }

  async queueContentTask(assetId: string, type: ContentJobType) {
    return await createContentJob({
      path: {
        assetId: assetId,
      },
      body: {
        type: type,
      },
      ...this.buildHeaders(),
    });
  }

  async checkAuthStatus() {
    return await checkAuthorization({});
  }

  async verifyAuthCode(code: string) {
    return await verifyAuthCode({
      query: {
        otp: code,
      },
    });
  }
}

const contentApi = new ContentApi();
export default contentApi;
