import {
  DescribeBatchJobResponse,
  PartialBatchJob,
  BatchJob,
  UpdateBatchJobResponse,
  CreateBatchJobResponse,
} from "@ncfritz/olympus-model";
import { BASE_URL, executeRequest } from "./apiBase";

const getBatchJob = async (id: string): Promise<BatchJob> => {
  const response: DescribeBatchJobResponse = await executeRequest({
    url: `${BASE_URL}/v1/job/batch/${id}`,
    method: "GET",
    successStatusCodes: [200],
  });

  return response.job;
};

const createBatchJob = async (
  type: string,
  publishNotification: boolean,
): Promise<BatchJob> => {
  const response: CreateBatchJobResponse = await executeRequest({
    url: `${BASE_URL}/v1/jobs/batch`,
    method: "POST",
    data: {
      type: type,
      publishNotification: publishNotification,
    },
    successStatusCodes: [200, 201],
  });

  return response.job;
};

const updateBatchJob = async (
  id: string,
  job: Partial<PartialBatchJob>,
): Promise<BatchJob> => {
  const response: UpdateBatchJobResponse = await executeRequest({
    url: `${BASE_URL}/v1/job/batch/${id}`,
    method: "PUT",
    data: job,
    successStatusCodes: [200],
  });

  return response.job;
};

const batchJobApi = {
  createBatchJob: createBatchJob,
  getBatchJob: getBatchJob,
  updateBatchJob: updateBatchJob,
};

export default batchJobApi;
