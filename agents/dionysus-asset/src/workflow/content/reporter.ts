import {
  ContentIngestionWorkflowStatus,
  ContentIngestionWorkflowStepStatus,
  ContentIngestionWorkflowStepType,
  PartialContentIngestionWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import moment from "moment";
import contentApi from "../../api/contentApi";

export const updateWorkflowStatus = async (
  workflowId: string,
  status: ContentIngestionWorkflowStatus,
) => {
  await contentApi.updateContentIngestionWorkflow(workflowId, {
    status: status,
    finishedTime: moment.utc().toISOString(),
  });
};

export const createStep = async (
  workflowId: string,
  type: ContentIngestionWorkflowStepType,
) => {
  return await contentApi.createContentIngestionWorkflowStep(workflowId, type);
};

export const updateStepProgress = async (
  workflowId: string,
  stepId: string,
  percent: number,
) => {
  await contentApi.updateContentIngestionWorkflowStep(workflowId, stepId, {
    progress: percent,
  });
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

  await contentApi.updateContentIngestionWorkflowStep(
    workflowId,
    stepId,
    update,
  );
};
