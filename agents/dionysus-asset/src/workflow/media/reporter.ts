import {
  MediaAssetWorkflowStepStatus,
  MediaAssetWorkflowStepType,
  PartialMediaAssetWorkflowStep,
  MediaAssetWorkflowSubStepType,
} from "@ncfritz/olympus-sdk/dionysus";
import moment from "moment";
import mediaApi from "../../api/mediaApi";
import notificationsApi from "../../api/notificationsApi";

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

  if ((status === "success" && updateWorkflow) || status === "failed") {
    const workflow = await mediaApi.describeMediaAssetWorkflow(workflowId);

    await notificationsApi.sendNotification({
      type: "dionysus_transcode_complete",
      // The notification agent looks the workflow (and its decoration) up.
      context: {
        workflowId: workflowId,
        workflowStatus: workflow.status,
      },
      webSocketDestination: {
        closable: true,
        level: status === "success" ? "success" : "error",
        durable: true,
        ttl: "P7D",
      },
      synoMailDestination: {
        from: "dionysus@internal.ncfritz.net",
        to: [
          {
            value: "ncfritz@internal.ncfritz.net",
          },
        ],
      },
    });
  }
};
