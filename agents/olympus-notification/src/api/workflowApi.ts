import {
  client,
  describeMetadataWorkflow,
  listMetadataWorkflowSteps,
} from "@ncfritz/olympus-sdk/dionysus";
import { BASE_URL } from "./apiBase";

class WorkflowApi {
  constructor() {
    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
    });
  }

  async describeWorkflow(workflowId: string) {
    const response = await describeMetadataWorkflow({
      path: {
        workflowId: workflowId,
      },
    });

    return response.data!.workflow;
  }

  async listWorkflowSteps(workflowId: string) {
    const response = await listMetadataWorkflowSteps({
      path: {
        workflowId: workflowId,
      },
    });

    return response.data!.steps;
  }
}

const workflowApi = new WorkflowApi();
export default workflowApi;
