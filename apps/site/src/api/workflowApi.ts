import {
  client,
  createMetadataWorkflow,
  describeMetadataWorkflow,
  getMetadataWorkflowStatistics,
  listMetadataWorkflows,
  listMetadataWorkflowSteps,
  updateMetadataWorkflow,
  type PartialWorkflow,
  type FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import { ApiBase } from "./apiBase";
import type { SortOptions } from "./common";

class WorkflowApi extends ApiBase {
  constructor() {
    super();

    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async createMetadataWorkflow() {
    return await createMetadataWorkflow({
      body: {},
    });
  }

  async describeMetadataWorkflow(id: string) {
    return await describeMetadataWorkflow({
      path: {
        workflowId: id,
      },
    });
  }

  async listMetadataWorkflows(
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    return await listMetadataWorkflows({
      query: {
        pageSize: pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async listMetadataWorkflowSteps(id: string) {
    return await listMetadataWorkflowSteps({
      path: {
        workflowId: id,
      },
    });
  }

  async updateWorkflow(id: string, updates: PartialWorkflow) {
    return await updateMetadataWorkflow({
      path: {
        workflowId: id,
      },
      body: {
        workflow: updates,
      },
    });
  }

  async getMetadataWorkflowStatistics() {
    return await getMetadataWorkflowStatistics();
  }
}

const workflowApi = new WorkflowApi();
export default workflowApi;
