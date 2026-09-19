import {
  client,
  describeMediaAssetWorkflowStep,
  describeMediaAssetWorkflow,
} from "@ncfritz/olympus-sdk/dionysus";
import { BASE_URL } from "./apiBase";

class MediaApi {
  constructor() {
    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
    });
  }

  async describeMediaAssetWorkflow(workflowId: string) {
    const response = await describeMediaAssetWorkflow({
      path: {
        workflowId: workflowId,
      },
    });

    return response.data!.workflow;
  }

  async describeMediaAssetWorkflowStep(
    workflowId: string,
    workflowStepId: string,
  ) {
    const response = await describeMediaAssetWorkflowStep({
      path: {
        workflowId: workflowId,
        workflowStepId: workflowStepId,
      },
    });

    return response.data!.step;
  }
}

const mediaApi = new MediaApi();
export default mediaApi;
