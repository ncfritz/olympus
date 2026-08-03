import {
  type BatchJob,
  client,
  createBatchJob,
  describeBatchJob,
  type JobType,
  type PartialBatchJob,
  updateBatchJob,
} from "@ncfritz/olympus-sdk/dionysus";
import { BASE_URL } from "./apiBase";
import { ExecuteWithMetrics } from "./executeDecorators";

class BatchJobApi {
  constructor() {
    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
    });
  }

  @ExecuteWithMetrics("Dionysus.DescribeBatchJob")
  async getBatchJob(id: string) {
    const response = await describeBatchJob({
      path: { jobId: id },
    });

    return response.data!.job;
  }

  @ExecuteWithMetrics("Dionysus.CreateBatchJob")
  async createBatchJob(
    type: JobType,
    publishNotification: boolean
  ): Promise<BatchJob> {
    const response = await createBatchJob({
      body: {
        type: type,
        publishNotification: publishNotification,
      },
    });

    return response.data!.job;
  }

  @ExecuteWithMetrics("Dionysus.UpdateBatchJob")
  async updateBatchJob(id: string, job: PartialBatchJob): Promise<BatchJob> {
    const response = await updateBatchJob({
      path: { jobId: id },
      body: { job: job },
    });

    return response.data!.job;
  }
}

const batchJobApi = new BatchJobApi();
export default batchJobApi;
