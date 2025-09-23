import {
  client,
  createMetadataWorkflow,
  describeMetadataWorkflow,
  getMetadataWorkflowStatistics,
  listMetadataWorkflows,
  listMetadataWorkflowSteps,
  updateMetadataWorkflow,
  type PartialWorkflow,
} from "@ncfritz/olympus-sdk/dionysus";
import type { FilterValue } from "antd/es/table/interface";
import type { SortOptions } from "./common";

class WorkflowApi {
  constructor() {
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
    filters?: Record<string, FilterValue | null>,
  ) {
    const encodedFilters = filters
      ? Buffer.from(JSON.stringify(filters)).toString("base64")
      : undefined;

    return await listMetadataWorkflows({
      query: {
        pageSize: pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: encodedFilters,
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
