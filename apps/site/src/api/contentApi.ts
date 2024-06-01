import axios from "axios";
import type {
  ContentAsset,
  ContentAssetTag,
} from "../pages/dionysus/content/assets";
import { store } from "../redux/store";

export interface SortOptions {
  field: string;
  order: "asc" | "desc";
}

const fetchAssets = async (page: number, sort: SortOptions) => {
  try {
    const listAssetsResponse = await axios.get(
      `/api/v1/content/assets?sort=${sort.order}&sortBy=${sort.field}&pageSize=15&startPage=${page}`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listAssetsResponse;
  } catch (e) {
    throw e;
  }
};

const fetchAsset = async (assetId: string) => {
  try {
    const getContentAssetResponse = await axios.get(
      `/api/v1/content/asset/${assetId}`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getContentAssetResponse;
  } catch (e) {
    throw e;
  }
};

const fetchUntaggedAsset = async () => {
  try {
    const getContentAssetResponse = await axios.get(
      `/api/v1/content/assets/untagged`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getContentAssetResponse;
  } catch (e) {
    throw e;
  }
};

const fetchSimilarAssets = async (
  asset: ContentAsset,
  tags: ContentAssetTag[],
) => {
  try {
    const tagTypes: string[] = [];
    const tagNames: string[] = [];

    tags.forEach((tag) => {
      tagTypes.push(tag.type);
      tagNames.push(tag.name);
    });

    const getContentAssetResponse = await axios.get(
      `/api/v1/content/asset/${
        asset.id
      }/similar?tagType=${tagTypes.join(",")}&tagName=${tagNames.join(",")}`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getContentAssetResponse;
  } catch (e) {
    throw e;
  }
};

const fetchTagsForAsset = async (assetId: string) => {
  try {
    const listAssetsTagsResponse = await axios.get(
      `/api/v1/content/asset/${assetId}/tags`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listAssetsTagsResponse;
  } catch (e) {
    throw e;
  }
};

const fetchAvailableTagsForAsset = async (assetId: string) => {
  try {
    const listAvailableTagsResponse = await axios.get(
      `/api/v1/content/assetTags?assetId=${assetId}`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listAvailableTagsResponse;
  } catch (e) {
    throw e;
  }
};

const getAssetAggregateStatistics = async () => {
  try {
    const getAssetAggregateStatisticsResponse = await axios.get(
      `/api/v1/content/assets/statistics/aggregate`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getAssetAggregateStatisticsResponse;
  } catch (e) {
    throw e;
  }
};

const getAssetDurationStatistics = async () => {
  try {
    const getAssetDurationStatisticsResponse = await axios.get(
      `/api/v1/content/assets/statistics/duration`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getAssetDurationStatisticsResponse;
  } catch (e) {
    throw e;
  }
};

const getAssetHeightStatistics = async () => {
  try {
    const getAssetHeightStatisticsResponse = await axios.get(
      `/api/v1/content/assets/statistics/height`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getAssetHeightStatisticsResponse;
  } catch (e) {
    throw e;
  }
};

const getAssetSizeStatistics = async () => {
  try {
    const getAssetSizeStatisticsResponse = await axios.get(
      `/api/v1/content/assets/statistics/size`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getAssetSizeStatisticsResponse;
  } catch (e) {
    throw e;
  }
};

const getAssetWidthStatistics = async () => {
  try {
    const getAssetWidthStatisticsResponse = await axios.get(
      `/api/v1/content/assets/statistics/width`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getAssetWidthStatisticsResponse;
  } catch (e) {
    throw e;
  }
};

const listTags = async () => {
  try {
    const getTagsResponse = await axios.get(`/api/v1/content/assetTags`, {
      headers: {
        "x-dionysus-content-bc": store.getState().blackCurtain.active,
      },
      validateStatus: (status) => {
        return status === 200;
      },
    });

    return getTagsResponse;
  } catch (e) {
    throw e;
  }
};

const addTagToAsset = async (assetId: string, type: string, name: string) => {
  try {
    const addTagToAssetResponse = await axios.put(
      `/api/v1/content/asset/${assetId}/tags`,
      {
        tag: {
          type: type,
          name: name,
        },
      },
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 200 || status === 304;
        },
      },
    );

    return addTagToAssetResponse;
  } catch (e) {
    throw e;
  }
};

const createAssetTag = async (type: string, name: string) => {
  try {
    const createTagResponse = await axios.post(
      `/api/v1/content/assetTags`,
      {
        tag: {
          type: type,
          name: name,
        },
      },
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 201 || status === 409;
        },
      },
    );

    return createTagResponse;
  } catch (e) {
    throw e;
  }
};

const removeTagFromAsset = async (assetId: string, tagId: string) => {
  try {
    const addTagToAssetResponse = await axios.delete(
      `/api/v1/content/asset/${assetId}/tag/${tagId}`,
      {
        headers: {
          "x-dionysus-content-bc": store.getState().blackCurtain.active,
        },
        validateStatus: (status) => {
          return status === 410;
        },
      },
    );

    return addTagToAssetResponse;
  } catch (e) {
    throw e;
  }
};

const queueContentTask = async (assetId: string, type: string) => {
  try {
    const createAssetJobResponse = await axios.put(
      `/api/v1/content/asset/${assetId}/jobs`,
      {
        tag: {
          type: type,
        },
      },
      {
        validateStatus: (status) => {
          return status === 200 || status === 304;
        },
      },
    );

    return createAssetJobResponse;
  } catch (e) {
    throw e;
  }
};

const checkAuthStatus = async () => {
  try {
    const checkAuthStatusResponse = await axios.get(
      `/api/v1/content/auth/status`,
      {
        withCredentials: true,
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return checkAuthStatusResponse;
  } catch (e) {
    throw e;
  }
};

const verifyAuthCode = async (code: string) => {
  try {
    const verifyAuthCodeResponse = await axios.get(
      `/api/v1/content/auth/verify?otp=${code}`,
      {
        withCredentials: true,
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return verifyAuthCodeResponse;
  } catch (e) {
    throw e;
  }
};

const contentApi = {
  addTagToAsset: addTagToAsset,
  checkAuthStatus: checkAuthStatus,
  createAssetTag: createAssetTag,
  getAsset: fetchAsset,
  getUntaggedAsset: fetchUntaggedAsset,
  getAssetAggregateStatistics: getAssetAggregateStatistics,
  getAssetDurationStatistics: getAssetDurationStatistics,
  getAssetHeightStatistics: getAssetHeightStatistics,
  getAssetSizeStatistics: getAssetSizeStatistics,
  getAssetWidthStatistics: getAssetWidthStatistics,
  listAssets: fetchAssets,
  listAssetTags: fetchTagsForAsset,
  listTags: listTags,
  listSimilarAssets: fetchSimilarAssets,
  listAvailableTagsForAsset: fetchAvailableTagsForAsset,
  queueContentTask: queueContentTask,
  removeTagFromAsset: removeTagFromAsset,
  verifyAuthCode: verifyAuthCode,
};

export default contentApi;
