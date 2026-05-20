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
} from "@ncfritz/olympus-sdk/dionysus";
import { BASE_URL } from "./apiBase";

class MediaApi {
  constructor() {
    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
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
}

const mediaApi = new MediaApi();
export default mediaApi;
