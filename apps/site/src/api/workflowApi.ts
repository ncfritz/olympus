import {
  client,
  createMetadataWorkflow,
  getMetadataWorkflowStatistics,
  listMetadataWorkflows,
  listMetadataWorkflowSteps,
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

  async getMetadataWorkflowStatistics() {
    return await getMetadataWorkflowStatistics();
  }
}

const workflowApi = new WorkflowApi();
export default workflowApi;
