import {
  client,
  createMetadataWorkflowStep,
  type PartialWorkflow,
  type PartialWorkflowStep,
  updateMetadataWorkflow,
} from "@ncfritz/olympus-sdk/dionysus";
import { BASE_URL } from "./apiBase";
import { ExecuteWithMetrics } from "./executeDecorators";

class WorkflowApi {
  constructor() {
    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
    });
  }

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

const workflowApi = new WorkflowApi();
export default workflowApi;
