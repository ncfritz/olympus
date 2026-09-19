import type {
  MediaAssetWorkflowStepStatus,
  MediaAssetWorkflowStepType,
  PartialMediaAssetWorkflowStep,
  MediaAssetWorkflowSubStepType,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import moment from "moment";
import { MediaApi } from "../../api/MediaApi";
import { NotificationApi } from "../../api/NotificationApi";

/**
 * Records a media workflow's steps and sub-steps, their progress and
 * status; notifies when the workflow ends or a step fails.
 */
@Injectable()
export class MediaReporter {
  constructor(
    private readonly mediaApi: MediaApi,
    private readonly notificationApi: NotificationApi,
  ) {}

  async createStep(workflowId: string, type: MediaAssetWorkflowStepType) {
    return await this.mediaApi.createMediaAssetWorkflowStep(workflowId, type);
  }

  async createSubStep(
    workflowId: string,
    workflowStepId: string,
    type: MediaAssetWorkflowSubStepType,
  ) {
    return await this.mediaApi.createMediaAssetWorkflowSubStep(
      workflowId,
      workflowStepId,
      type,
    );
  }

  async updateStepProgress(
    workflowId: string,
    stepId: string,
    percent: number,
  ) {
    await this.mediaApi.updateMediaAssetWorkflowStep(workflowId, stepId, {
      progress: percent,
    });
  }

  async updateStepStatus(
    workflowId: string,
    stepId: string,
    status: MediaAssetWorkflowStepStatus,
    updateWorkflow: boolean = false,
  ) {
    const update: PartialMediaAssetWorkflowStep = {
      status: status,
      finishedTime: moment.utc().toISOString(),
    };

    if (status === "success") {
      update.progress = 100;
    }

    await this.mediaApi.updateMediaAssetWorkflowStep(
      workflowId,
      stepId,
      update,
      updateWorkflow,
    );

    if ((status === "success" && updateWorkflow) || status === "failed") {
      const workflow =
        await this.mediaApi.describeMediaAssetWorkflow(workflowId);

      await this.notificationApi.sendNotification({
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
  }
}
