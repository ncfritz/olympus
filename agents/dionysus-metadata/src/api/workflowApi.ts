import {
  CreateWorkflowResponse,
  CreateWorkflowStepResponse,
  JobType,
  PartialWorkflow,
  UpdateWorkflowResponse,
  Workflow,
  WorkflowStep,
  WorkflowStepType,
} from "@ncfritz/olympus-model";
import { BASE_URL, executeRequest } from "./apiBase";

const createWorkflow = async (): Promise<Workflow> => {
  const response: CreateWorkflowResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/workflows`,
    method: "POST",
    data: {},
    successStatusCodes: [200, 201],
  });

  return response.workflow;
};

const updateWorkflow = async (
  id: string,
  workflow: Partial<PartialWorkflow>,
): Promise<Workflow> => {
  const response: UpdateWorkflowResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/workflow/${id}`,
    method: "PUT",
    data: {
      workflow: workflow,
    },
    successStatusCodes: [200],
  });

  return response.workflow;
};

const createWorkflowStep = async (
  workflowId: string,
  type: WorkflowStepType,
  jobType: JobType,
  options: {
    attempt?: number;
    offset?: number;
  } = { attempt: 0, offset: 0 },
): Promise<WorkflowStep> => {
  const response: CreateWorkflowStepResponse = await executeRequest({
    url: `${BASE_URL}/v1/metadata/workflow/${workflowId}/steps`,
    method: "POST",
    data: {
      step: {
        attempt: options.attempt,
        offset: options.offset,
        type: type,
        jobType: jobType,
      },
    },
    successStatusCodes: [200, 201],
  });

  return response.step;
};

const workflowApi = {
  createWorkflow: createWorkflow,
  createWorkflowStep: createWorkflowStep,
  updateWorkflow: updateWorkflow,
};

export default workflowApi;
