import {
  AddContentAssetTagToAssetRequest,
  ContentTagType,
  CreateContentAssetRequest,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  addContentAssetTagToAsset,
  client,
  ContentIngestionWorkflowStepType,
  createContentAsset,
  createContentIngestionWorkflowStep,
  describeContentIngestionWorkflow,
  listDuplicateContentAssets,
  PartialContentIngestionWorkflow,
  PartialContentIngestionWorkflowStep,
  updateContentIngestionWorkflow,
  updateContentIngestionWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import { AssetMetadata } from "../workflow/content/workflow";
import { BASE_URL } from "./apiBase";

class ContentApi {
  constructor() {
    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
    });
  }

  async createContentAsset(metadata: AssetMetadata) {
    const createContentAssetRequest: CreateContentAssetRequest = {
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

    const response = await createContentAsset({
      body: createContentAssetRequest,
    });

    return response.data!.asset;
  }

  async addContentAssetTag(
    assetId: string,
    tagName: string,
    tagType: ContentTagType,
  ) {
    const addTagRequest: AddContentAssetTagToAssetRequest = {
      tag: {
        name: tagName,
        type: tagType,
      },
    };

    await addContentAssetTagToAsset({
      path: {
        assetId: assetId,
      },
      body: addTagRequest,
    });
  }

  async describeContentIngestionWorkflow(workflowId: string) {
    const response = await describeContentIngestionWorkflow({
      path: {
        workflowId: workflowId,
      },
    });

    return response.data!.workflow;
  }

  async updateContentIngestionWorkflow(
    workflowId: string,
    workflow: PartialContentIngestionWorkflow,
  ) {
    const response = await updateContentIngestionWorkflow({
      path: {
        workflowId: workflowId,
      },
      body: {
        workflow: workflow,
      },
    });

    return response.data!.workflow;
  }

  async createContentIngestionWorkflowStep(
    workflowId: string,
    type: ContentIngestionWorkflowStepType,
  ) {
    const response = await createContentIngestionWorkflowStep({
      path: {
        workflowId: workflowId,
      },
      body: {
        step: {
          type: type,
        },
      },
    });

    return response.data!.step;
  }

  async updateContentIngestionWorkflowStep(
    workflowId: string,
    workflowStepId: string,
    step: PartialContentIngestionWorkflowStep,
  ) {
    const response = await updateContentIngestionWorkflowStep({
      path: {
        workflowId: workflowId,
        workflowStepId: workflowStepId,
      },
      body: {
        step: step,
      },
    });

    return response.data!.step;
  }

  async checkDuplicates(sha: string) {
    const response = await listDuplicateContentAssets({
      query: {
        digest: sha,
      },
    });

    return response.data!.assets;
  }
}

const contentApi = new ContentApi();
export default contentApi;
