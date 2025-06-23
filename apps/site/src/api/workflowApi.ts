import type { FilterValue } from "antd/es/table/interface";
import axios from "axios";
import type { SortOptions } from "./metadataApi";

const createWorkflow = async () => {
  try {
    const createWorkflowResponse = await axios.post(
      `/api/v1/metadata/workflows`,
      {},
      {
        validateStatus: (status) => {
          return status === 201;
        },
      },
    );

    return createWorkflowResponse;
  } catch (e) {
    throw e;
  }
};

const fetchMetadataWorkflows = async (
  page: number,
  pageSize: number,
  sort: SortOptions,
  filters?: Record<string, FilterValue | null>,
) => {
  try {
    const url = `/api/v1/metadata/workflows`;
    const queryString = [
      `sort=${sort.order}`,
      `sortBy=${sort.field}`,
      `pageSize=${pageSize}`,
      `startPage=${page}`,
    ];

    if (filters) {
      queryString.push(
        `filters=${Buffer.from(JSON.stringify(filters)).toString("base64")}`,
      );
    }

    const listMetadataFWorkflowsResponse = await axios.get(
      `${url}?${queryString.join("&")}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listMetadataFWorkflowsResponse;
  } catch (e) {
    throw e;
  }
};

const fetchMetadataWorkflowSteps = async (id: string) => {
  try {
    const listWorkflowStepsResponse = await axios.get(
      `/api/v1/metadata/workflow/${id}/steps`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listWorkflowStepsResponse;
  } catch (e) {
    throw e;
  }
};

const fetchMetadataWorkflowStatistics = async () => {
  try {
    const getWorkflowStatisticsResponse = await axios.get(
      `/api/v1/metadata/workflow/stats`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getWorkflowStatisticsResponse;
  } catch (e) {
    throw e;
  }
};

const workflowApi = {
  createWorkflow: createWorkflow,
  getWorkflowStatistics: fetchMetadataWorkflowStatistics,
  listMetadataWorkflows: fetchMetadataWorkflows,
  listMetadataWorkflowSteps: fetchMetadataWorkflowSteps,
};

export default workflowApi;
