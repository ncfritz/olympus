import {
  describeMetadataWorkflow,
  listMetadataWorkflowSteps,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";

/** Dionysus metadata workflows, through the SDK. */
@Injectable()
export class WorkflowApi {
  async describeWorkflow(workflowId: string) {
    const response = await describeMetadataWorkflow({
      path: { workflowId },
    });
    return response.data!.workflow;
  }

  async listWorkflowSteps(workflowId: string) {
    const response = await listMetadataWorkflowSteps({
      path: { workflowId },
    });
    return response.data!.steps;
  }
}
