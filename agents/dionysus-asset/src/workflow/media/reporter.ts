import {
  MediaAssetWorkflowStepStatus,
  MediaAssetWorkflowStepType,
  PartialMediaAssetWorkflowStep,
  MediaAssetWorkflowSubStepType,
} from "@ncfritz/olympus-sdk/dionysus";
import moment from "moment";
import mediaApi from "../../api/mediaApi";

export const createStep = async (
  workflowId: string,
  type: MediaAssetWorkflowStepType,
) => {
  return await mediaApi.createMediaAssetWorkflowStep(workflowId, type);
};

export const createSubStep = async (
  workflowId: string,
  workflowStepId: string,
  type: MediaAssetWorkflowSubStepType,
) => {
  return await mediaApi.createMediaAssetWorkflowSubStep(
    workflowId,
    workflowStepId,
    type,
  );
};

export const updateStepProgress = async (
  workflowId: string,
  stepId: string,
  percent: number,
) => {
  await mediaApi.updateMediaAssetWorkflowStep(workflowId, stepId, {
    progress: percent,
  });
};

export const updateStepStatus = async (
  workflowId: string,
  stepId: string,
  status: MediaAssetWorkflowStepStatus,
  updateWorkflow: boolean = false,
) => {
  const update: PartialMediaAssetWorkflowStep = {
    status: status,
    finishedTime: moment.utc().toISOString(),
  };

  if (status === "success") {
    update.progress = 100;
  }

  await mediaApi.updateMediaAssetWorkflowStep(
    workflowId,
    stepId,
    update,
    updateWorkflow,
  );
};
