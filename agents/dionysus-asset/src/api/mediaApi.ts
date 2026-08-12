import {
  client,
  createMediaAssetWorkflowStep,
  createMediaAssetWorkflowSubStep,
  MediaAssetWorkflowStepType,
  updateMediaAssetWorkflowStep,
  PartialMediaAssetWorkflowStep,
  approveMediaAssetTranscodeConfiguration,
  describeMediaAssetWorkflowStep,
  MediaAssetWorkflowSubStepType,
  verifyMediaAssetTranscodeConfiguration,
  describeMediaAssetWorkflow,
  createMediaAsset,
  BaseMediaAsset,
  MediaAssetDownloadStatusUpdate,
  bulkUpdateMediaAssetDownloads,
  PartialMediaAssetDownload,
  SearchResultStatus,
  updateMediaAssetDownloadByNzbId,
  MediaAssetSearchType,
  updateMediaAssetDownload,
  deleteMediaAssetWorkflow,
} from "@ncfritz/olympus-sdk/dionysus";
import { BASE_URL } from "./apiBase";

class MediaApi {
  constructor() {
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

  async createMediaAsset(asset: BaseMediaAsset) {
    const response = await createMediaAsset({
      body: {
        asset: asset,
      },
    });

    return response.data.asset;
  }

  async createMediaAssetWorkflowStep(
    workflowId: string,
    type: MediaAssetWorkflowStepType,
  ) {
    const response = await createMediaAssetWorkflowStep({
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

  async createMediaAssetWorkflowSubStep(
    workflowId: string,
    workflowStepId: string,
    type: MediaAssetWorkflowSubStepType,
  ) {
    const response = await createMediaAssetWorkflowSubStep({
      path: {
        workflowId: workflowId,
        workflowStepId: workflowStepId,
      },
      body: {
        step: {
          type: type,
        },
      },
    });

    return response.data!.step;
  }

  async describeMediaAssetWorkflow(workflowId: string) {
    const response = await describeMediaAssetWorkflow({
      path: {
        workflowId: workflowId,
      },
    });

    return response.data!.workflow;
  }

  async describeMediaAssetWorkflowStep(
    workflowId: string,
    workflowStepId: string,
  ) {
    const response = await describeMediaAssetWorkflowStep({
      path: {
        workflowId: workflowId,
        workflowStepId: workflowStepId,
      },
    });

    return response.data!.step;
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

  async updateMediaAssetWorkflowStep(
    workflowId: string,
    workflowStepId: string,
    step: PartialMediaAssetWorkflowStep,
    updateWorkflow: boolean = false,
  ) {
    const response = await updateMediaAssetWorkflowStep({
      path: {
        workflowId: workflowId,
        workflowStepId: workflowStepId,
      },
      query: {
        updateWorkflowStatus: updateWorkflow,
      },
      body: {
        step: step,
      },
    });

    return response.data!.step;
  }

  async approveMediaAssetTranscodeConfiguration(
    workflowId: string,
    workflowStepId: string,
    originalAssetExtension: string,
    videoTrackIndex: number,
    audioTrackIndex: number,
    subtitleTrackIndex?: number,
    verificationRequired?: boolean,
  ) {
    await approveMediaAssetTranscodeConfiguration({
      path: {
        workflowId: workflowId,
        workflowStepId: workflowStepId,
      },
      body: {
        originalAssetExtension: originalAssetExtension,
        videoTrackIndex: videoTrackIndex,
        audioTrackIndex: audioTrackIndex,
        subtitleTrackIndex: subtitleTrackIndex,
        verificationRequired: verificationRequired,
      },
    });
  }

  async verifyMediaAssetTranscodeConfiguration(
    workflowId: string,
    workflowStepId: string,
  ) {
    await verifyMediaAssetTranscodeConfiguration({
      path: {
        workflowId: workflowId,
        workflowStepId: workflowStepId,
      },
    });
  }

  async deleteMediaAssetWorkflow(workflowId: string, hardDelete = false) {
    await deleteMediaAssetWorkflow({
      path: {
        workflowId: workflowId,
      },
      query: {
        hardDelete: hardDelete,
      },
    });
  }
}

const mediaApi = new MediaApi();
export default mediaApi;
