import {
  describeMediaAssetWorkflow,
  describeMediaAssetWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";

/** Dionysus media asset workflows, through the SDK. */
@Injectable()
export class MediaApi {
  async describeMediaAssetWorkflow(workflowId: string) {
    const response = await describeMediaAssetWorkflow({
      path: { workflowId },
    });
    return response.data!.workflow;
  }

  async describeMediaAssetWorkflowStep(
    workflowId: string,
    workflowStepId: string,
  ) {
    const response = await describeMediaAssetWorkflowStep({
      path: { workflowId, workflowStepId },
    });
    return response.data!.step;
  }
}
