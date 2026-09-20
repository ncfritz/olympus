import {
  createMetadataWorkflowStep,
  describeMetadataWorkflow,
  listMetadataWorkflowSteps,
  type PartialWorkflow,
  type PartialWorkflowStep,
  updateMetadataWorkflow,
} from "@ncfritz/olympus-sdk/dionysus";
import type { OlympusClients } from "../clients";

/** Dionysus metadata workflows and their steps. */
export class MetadataWorkflowApi {
  constructor(private readonly clients: OlympusClients) {}

  async describeMetadataWorkflow(workflowId: string) {
    const response = await describeMetadataWorkflow({
      client: this.clients.dionysus,
      path: { workflowId },
    });
    return response.data.workflow;
  }

  async updateMetadataWorkflow(workflowId: string, workflow: PartialWorkflow) {
    const response = await updateMetadataWorkflow({
      client: this.clients.dionysus,
      path: { workflowId },
      body: { workflow },
    });
    return response.data.workflow;
  }

  async listMetadataWorkflowSteps(workflowId: string) {
    const response = await listMetadataWorkflowSteps({
      client: this.clients.dionysus,
      path: { workflowId },
    });
    return response.data.steps;
  }

  async createMetadataWorkflowStep(
    workflowId: string,
    step: PartialWorkflowStep,
  ) {
    const response = await createMetadataWorkflowStep({
      client: this.clients.dionysus,
      path: { workflowId },
      body: { step },
    });
    return response.data.step;
  }
}
