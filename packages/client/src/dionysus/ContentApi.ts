import {
  addContentAssetTagToAsset,
  type BaseContentAsset,
  type BaseContentAssetTag,
  type ContentIngestionWorkflowStepType,
  createContentAsset,
  createContentIngestionWorkflowStep,
  describeContentIngestionWorkflow,
  listDuplicateContentAssets,
  type PartialContentIngestionWorkflow,
  type PartialContentIngestionWorkflowStep,
  updateContentIngestionWorkflow,
  updateContentIngestionWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import type { OlympusClients } from "../clients";

/** Dionysus content assets, their tags and ingestion workflows. */
export class ContentApi {
  constructor(private readonly clients: OlympusClients) {}

  async createContentAsset(asset: BaseContentAsset) {
    const response = await createContentAsset({
      client: this.clients.dionysus,
      body: { asset },
    });
    return response.data.asset;
  }

  async addContentAssetTagToAsset(assetId: string, tag: BaseContentAssetTag) {
    await addContentAssetTagToAsset({
      client: this.clients.dionysus,
      path: { assetId },
      body: { tag },
    });
  }

  /** Content assets with this SHA-256 digest. */
  async listDuplicateContentAssets(digest: string) {
    const response = await listDuplicateContentAssets({
      client: this.clients.dionysus,
      query: { digest },
    });
    return response.data.assets;
  }

  async describeContentIngestionWorkflow(workflowId: string) {
    const response = await describeContentIngestionWorkflow({
      client: this.clients.dionysus,
      path: { workflowId },
    });
    return response.data.workflow;
  }

  async updateContentIngestionWorkflow(
    workflowId: string,
    workflow: PartialContentIngestionWorkflow,
  ) {
    const response = await updateContentIngestionWorkflow({
      client: this.clients.dionysus,
      path: { workflowId },
      body: { workflow },
    });
    return response.data.workflow;
  }

  async createContentIngestionWorkflowStep(
    workflowId: string,
    type: ContentIngestionWorkflowStepType,
  ) {
    const response = await createContentIngestionWorkflowStep({
      client: this.clients.dionysus,
      path: { workflowId },
      body: { step: { type } },
    });
    return response.data.step;
  }

  async updateContentIngestionWorkflowStep(
    workflowId: string,
    workflowStepId: string,
    step: PartialContentIngestionWorkflowStep,
  ) {
    const response = await updateContentIngestionWorkflowStep({
      client: this.clients.dionysus,
      path: { workflowId, workflowStepId },
      body: { step },
    });
    return response.data.step;
  }
}
