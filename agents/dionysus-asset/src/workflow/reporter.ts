import {
  ContentIngestionWorkflowStatus,
  ContentIngestionWorkflowStepStatus,
  ContentIngestionWorkflowStepType,
  PartialContentIngestionWorkflowStep
} from "@ncfritz/olympus-sdk/dionysus";
import moment from "moment";
import contentAssetsApi from "../api/contentAssets";

export const updateWorkflowStatus = async (
  workflowId: string,
  status: ContentIngestionWorkflowStatus,
) => {
  await contentAssetsApi.updateContentIngestionWorkflow(workflowId, {
    status: status,
    finishedTime: moment.utc().toISOString(),
  });
};

export const createStep = async (
  workflowId: string,
  type: ContentIngestionWorkflowStepType,
) => {
  return await contentAssetsApi.createContentIngestionWorkflowStep(
    workflowId,
    type,
  );
};

export const updateStepProgress = async (
  workflowId: string,
  stepId: string,
  percent: number,
) => {
  await contentAssetsApi.updateContentIngestionWorkflowStep(
    workflowId,
    stepId,
    {
      progress: percent,
    },
  );
};

export const updateStepStatus = async (
  workflowId: string,
  stepId: string,
  status: ContentIngestionWorkflowStepStatus,
) => {
  const update: PartialContentIngestionWorkflowStep = {
    status: status,
    finishedTime: moment.utc().toISOString(),
  };

  if (status === "success") {
    update.progress = 100;
  }

  await contentAssetsApi.updateContentIngestionWorkflowStep(
    workflowId,
    stepId,
    update,
  );
};
