import {
  approveMediaAssetTranscodeConfiguration,
  type ApproveMediaAssetTranscodeConfigurationRequest,
  type BaseMediaAsset,
  bulkUpdateMediaAssetDownloads,
  createMediaAsset,
  createMediaAssetWorkflowStep,
  createMediaAssetWorkflowSubStep,
  deleteMediaAssetWorkflow,
  describeMediaAssetWorkflow,
  describeMediaAssetWorkflowStep,
  type MediaAssetDownloadStatusUpdate,
  type MediaAssetSearchType,
  type MediaAssetWorkflowStepType,
  type MediaAssetWorkflowSubStepType,
  type PartialMediaAssetDownload,
  type PartialMediaAssetWorkflow,
  type PartialMediaAssetWorkflowStep,
  type SearchResultStatus,
  updateMediaAssetDownload,
  updateMediaAssetDownloadByNzbId,
  updateMediaAssetWorkflow,
  updateMediaAssetWorkflowStep,
  verifyMediaAssetTranscodeConfiguration,
} from "@ncfritz/olympus-sdk/dionysus";
import type { OlympusClients } from "../clients";
import { okOrNotFound } from "../filters";

/** Dionysus media assets, their downloads and media workflows. */
export class MediaApi {
  constructor(private readonly clients: OlympusClients) {}

  async createMediaAsset(asset: BaseMediaAsset) {
    const response = await createMediaAsset({
      client: this.clients.dionysus,
      body: { asset },
    });
    return response.data.asset;
  }

  async bulkUpdateMediaAssetDownloads(
    updates: MediaAssetDownloadStatusUpdate[],
  ) {
    const response = await bulkUpdateMediaAssetDownloads({
      client: this.clients.dionysus,
      body: { updates },
    });
    return response.data.updates;
  }

  async updateMediaAssetDownload(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    resultId: string,
    downloadId: string,
    download: PartialMediaAssetDownload,
  ) {
    const response = await updateMediaAssetDownload({
      client: this.clients.dionysus,
      path: { mediaType, mediaId, resultId, downloadId },
      body: { download },
    });
    return response.data.download;
  }

  /** The updated download; undefined when no download has this NZB id. */
  async updateMediaAssetDownloadByNzbId(
    nzbId: number,
    download: PartialMediaAssetDownload,
    searchResultStatus: SearchResultStatus,
  ) {
    const response = await updateMediaAssetDownloadByNzbId({
      client: this.clients.dionysus,
      path: { nzbId },
      body: { download, searchResultStatus },
      validateStatus: okOrNotFound,
    });
    return response.status === 404 ? undefined : response.data.download;
  }

  async describeMediaAssetWorkflow(workflowId: string) {
    const response = await describeMediaAssetWorkflow({
      client: this.clients.dionysus,
      path: { workflowId },
    });
    return response.data.workflow;
  }

  async updateMediaAssetWorkflow(
    workflowId: string,
    workflow: PartialMediaAssetWorkflow,
  ) {
    const response = await updateMediaAssetWorkflow({
      client: this.clients.dionysus,
      path: { workflowId },
      body: { workflow },
    });
    return response.data.workflow;
  }

  async deleteMediaAssetWorkflow(workflowId: string, hardDelete = false) {
    await deleteMediaAssetWorkflow({
      client: this.clients.dionysus,
      path: { workflowId },
      query: { hardDelete },
    });
  }

  async createMediaAssetWorkflowStep(
    workflowId: string,
    type: MediaAssetWorkflowStepType,
  ) {
    const response = await createMediaAssetWorkflowStep({
      client: this.clients.dionysus,
      path: { workflowId },
      body: { step: { type } },
    });
    return response.data.step;
  }

  async describeMediaAssetWorkflowStep(
    workflowId: string,
    workflowStepId: string,
  ) {
    const response = await describeMediaAssetWorkflowStep({
      client: this.clients.dionysus,
      path: { workflowId, workflowStepId },
    });
    return response.data.step;
  }

  async updateMediaAssetWorkflowStep(
    workflowId: string,
    workflowStepId: string,
    step: PartialMediaAssetWorkflowStep,
    updateWorkflowStatus = false,
  ) {
    const response = await updateMediaAssetWorkflowStep({
      client: this.clients.dionysus,
      path: { workflowId, workflowStepId },
      query: { updateWorkflowStatus },
      body: { step },
    });
    return response.data.step;
  }

  async createMediaAssetWorkflowSubStep(
    workflowId: string,
    workflowStepId: string,
    type: MediaAssetWorkflowSubStepType,
  ) {
    const response = await createMediaAssetWorkflowSubStep({
      client: this.clients.dionysus,
      path: { workflowId, workflowStepId },
      body: { step: { type } },
    });
    return response.data.step;
  }

  async approveMediaAssetTranscodeConfiguration(
    workflowId: string,
    workflowStepId: string,
    configuration: ApproveMediaAssetTranscodeConfigurationRequest,
  ) {
    await approveMediaAssetTranscodeConfiguration({
      client: this.clients.dionysus,
      path: { workflowId, workflowStepId },
      body: configuration,
    });
  }

  async verifyMediaAssetTranscodeConfiguration(
    workflowId: string,
    workflowStepId: string,
  ) {
    await verifyMediaAssetTranscodeConfiguration({
      client: this.clients.dionysus,
      path: { workflowId, workflowStepId },
    });
  }
}
