import type {
  ContentIngestionWorkflowStatus,
  ContentIngestionWorkflowStepStatus,
  ContentIngestionWorkflowStepType,
  PartialContentIngestionWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import moment from "moment";
import { ContentApi } from "@ncfritz/olympus-client";

/** Records a content ingestion workflow's steps, progress and status. */
@Injectable()
export class ContentReporter {
  constructor(private readonly contentApi: ContentApi) {}

  async updateWorkflowStatus(
    workflowId: string,
    status: ContentIngestionWorkflowStatus,
  ) {
    await this.contentApi.updateContentIngestionWorkflow(workflowId, {
      status: status,
      finishedTime: moment.utc().toISOString(),
    });
  }

  async createStep(workflowId: string, type: ContentIngestionWorkflowStepType) {
    return await this.contentApi.createContentIngestionWorkflowStep(
      workflowId,
      type,
    );
  }

  async updateStepProgress(
    workflowId: string,
    stepId: string,
    percent: number,
  ) {
    await this.contentApi.updateContentIngestionWorkflowStep(
      workflowId,
      stepId,
      {
        progress: percent,
      },
    );
  }

  async updateStepStatus(
    workflowId: string,
    stepId: string,
    status: ContentIngestionWorkflowStepStatus,
  ) {
    const update: PartialContentIngestionWorkflowStep = {
      status: status,
      finishedTime: moment.utc().toISOString(),
    };

    if (status === "success") {
      update.progress = 100;
    }

    await this.contentApi.updateContentIngestionWorkflowStep(
      workflowId,
      stepId,
      update,
    );
  }
}
