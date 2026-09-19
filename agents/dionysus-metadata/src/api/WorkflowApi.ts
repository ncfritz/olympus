import { ExecuteWithMetrics } from "@ncfritz/olympus-nest";
import {
  createMetadataWorkflowStep,
  type PartialWorkflow,
  type PartialWorkflowStep,
  updateMetadataWorkflow,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";

/** Dionysus metadata workflows, through the SDK. */
@Injectable()
export class WorkflowApi {
  @ExecuteWithMetrics("Dionysus.CreateMetadataWorkflowStep")
  async createWorkflowStep(workflowId: string, step: PartialWorkflowStep) {
    const response = await createMetadataWorkflowStep({
      path: {
        workflowId: workflowId,
      },
      body: {
        step: step,
      },
    });

    return response.data!.step;
  }

  @ExecuteWithMetrics("Dionysus.UpdateMetadataWorkflow")
  async updateWorkflow(id: string, workflow: PartialWorkflow) {
    const response = await updateMetadataWorkflow({
      path: {
        workflowId: id,
      },
      body: {
        workflow: workflow,
      },
    });

    return response.data!.workflow;
  }
}
