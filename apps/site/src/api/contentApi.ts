import {
  addContentAssetTagToAsset,
  type BaseContentAssetChannel,
  checkAuthorization,
  client,
  type ContentAsset,
  type ContentAssetTag,
  type ContentIngestionWorkflowAssetLocation,
  type ContentJobType,
  type ContentTagType,
  createContentAssetChannel,
  createContentAssetChannelCategory,
  createContentAssetTag,
  createContentIngestionWorkflow,
  createContentJob,
  deleteContentAssetTagFromAsset,
  describeContentIngestionWorkflow,
  type FilterDefinition,
  favoriteContentAssetChannel,
  getContentAsset,
  getContentAssetAggregateStatistics,
  getContentAssetDurationStatistics,
  getContentAssetHeightStatistics,
  getContentAssetSizeStatistics,
  getContentAssetWidthStatistics,
  getContentIngestionWorkflowStatistics,
  getUntaggedContentAsset,
  listAvailableContentAssetTags,
  listContentAssetChannelCategories,
  listContentAssets,
  listContentAssetTagsForAsset,
  listContentIngestionWorkflows,
  listSimilarContentAssets,
  refreshContentAssetChannel,
  setContentAssetRating,
  updateContentAssetChannel,
  verifyAuthCode,
  deleteContentAssetChannel,
  describeContentAssetChannelCategory,
  type BaseContentAssetChannelCategory,
  updateContentAssetChannelCategory,
  listContentAssetChannels,
  describeContentAssetChannel,
  listContentAssetChannelsForCategory,
} from "@ncfritz/olympus-sdk/dionysus";
import { store } from "../redux/store";
import { ApiBase } from "./apiBase";
import type { SortOptions } from "./common";

class ContentApi extends ApiBase {
  constructor() {
    super();

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

  async createContentAssetChannelCategory(
    category: BaseContentAssetChannelCategory,
  ) {
    return await createContentAssetChannelCategory({
      body: {
        category: category,
      },
    });
  }

  async updateContentAssetChannelCategory(
    categoryId: string,
    category: BaseContentAssetChannelCategory,
  ) {
    return await updateContentAssetChannelCategory({
      path: {
        categoryId: categoryId,
      },
      body: {
        category: category,
      },
    });
  }

  async describeContentAssetChannel(channelId: string) {
    return await describeContentAssetChannel({
      path: {
        channelId: channelId,
      },
    });
  }

  async describeContentAssetChannelCategory(categoryId: string) {
    return await describeContentAssetChannelCategory({
      path: {
        categoryId: categoryId,
      },
    });
  }

  async createContentAssetChannel(channel: BaseContentAssetChannel) {
    return await createContentAssetChannel({
      body: {
        channel: channel,
      },
    });
  }

  async deleteContentAssetChannel(channelId: string) {
    return await deleteContentAssetChannel({
      path: {
        channelId: channelId,
      },
      validateStatus: (status) => {
        return status === 410;
      },
    });
  }

  async updateContentAssetChannel(
    channelId: string,
    updates: BaseContentAssetChannel,
  ) {
    return await updateContentAssetChannel({
      path: {
        channelId: channelId,
      },
      body: {
        channel: updates,
      },
    });
  }

  async favoriteContentAssetChannel(channelId: string, favorite: boolean) {
    return await favoriteContentAssetChannel({
      path: {
        channelId: channelId,
      },
      body: {
        favorite: favorite,
      },
    });
  }

  async refreshContentAssetChannel(channelId: string) {
    return await refreshContentAssetChannel({
      path: {
        channelId: channelId,
      },
    });
  }

  async listAssets(
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    return await listContentAssets({
      query: {
        startPage: page,
        pageSize: pageSize,
        sortBy: sort.field,
        sort: sort.order,
        filters: filters
          ? `${Buffer.from(JSON.stringify(filters)).toString("base64")}`
          : undefined,
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

  async listContentAssetChannelCategories(
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    return await listContentAssetChannelCategories({
      query: {
        pageSize: pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async listContentAssetChannelsForCategory(
    categoryId: string,
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    return await listContentAssetChannelsForCategory({
      path: {
        categoryId: categoryId,
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

  async listContentAssetChannels(
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    return await listContentAssetChannels({
      query: {
        pageSize: pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async listAssetTags(assetId: string) {
    return await listContentAssetTagsForAsset({
      path: {
        assetId: assetId,
      },
    });
  }

  async listAvailableTagsForAsset(assetId: string) {
    return await listAvailableContentAssetTags({
      query: {
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
      validateStatus: (status) => {
        return status === 410;
      },
    });
  }

  async createContentIngestionWorkflow(
    source: string,
    sourceType: ContentIngestionWorkflowAssetLocation,
  ) {
    return await createContentIngestionWorkflow({
      body: {
        workflow: {
          source: source,
          sourceType: sourceType,
        },
      },
    });
  }

  async listContentIngestionWorkflows(
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    return await listContentIngestionWorkflows({
      query: {
        pageSize: pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async describeContentIngestionWorkflow(workflowId: string) {
    return await describeContentIngestionWorkflow({
      path: {
        workflowId: workflowId,
      },
    });
  }

  async getContentIngestionWorkflowStatistics() {
    return await getContentIngestionWorkflowStatistics({});
  }

  async setContentAssetRating(assetId: string, rating: number) {
    return await setContentAssetRating({
      path: {
        assetId: assetId,
      },
      body: {
        rating: rating,
      },
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
    return await checkAuthorization({
      validateStatus: (status) => {
        return status === 200 || status === 401;
      },
    });
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
