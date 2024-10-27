import {
  AddContentAssetTagToAssetRequest,
  ContentTagType,
  CreateContentAssetRequest,
  ListDuplicateContentAssetsResponse,
} from "@ncfritz/olympus-model";
import { AssetMetadata } from "../workflow/workflow";
import { BASE_URL, executeRequest } from "./apiBase";

const createContentAsset = async (metadata: AssetMetadata): Promise<void> => {
  const createcontwentAssetRequest: CreateContentAssetRequest = {
    asset: {
      id: metadata.id,
      originalName: metadata.name,
      originalSha: metadata.inputSha256!,
      originalSizeBytes: metadata.originalSize!,
      newSha: metadata.outputSha256!,
      newSizeBytes: metadata.assetSize!,
      durationMs: metadata.duration!,
      width: metadata.width!,
      height: metadata.height!,
    },
  };

  await executeRequest({
    url: `${BASE_URL}/v1/content/assets`,
    method: "POST",
    data: createcontwentAssetRequest,
    successStatusCodes: [200, 201],
  });
};

const addContentAssetTag = async (
  assetId: string,
  tagName: string,
  tagType: ContentTagType
): Promise<void> => {
  const addTagRequest: AddContentAssetTagToAssetRequest = {
    tag: {
      name: tagName,
      type: tagType,
    },
  };

  await executeRequest({
    url: `${BASE_URL}/v1/content/asset/${assetId}/tags`,
    method: "PUT",
    data: addTagRequest,
    successStatusCodes: [200, 304],
  });
};

const checkDuplicates = async (sha: string) => {
  const checkDuplicatesResponse =
    await executeRequest<ListDuplicateContentAssetsResponse>({
      url: `${BASE_URL}/v1/content/assets/duplicates?digest=${sha}`,
      method: "GET",
      successStatusCodes: [200],
    });

  return checkDuplicatesResponse.assets;
};

const contentAssetsApi = {
  createContentAsset: createContentAsset,
  addTag: addContentAssetTag,
  checkDuplicates: checkDuplicates,
};
export default contentAssetsApi;
