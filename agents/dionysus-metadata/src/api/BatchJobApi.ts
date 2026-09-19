import { ExecuteWithMetrics } from "@ncfritz/olympus-nest";
import {
  type BatchJob,
  createBatchJob,
  describeBatchJob,
  type JobType,
  type PartialBatchJob,
  updateBatchJob,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";

/** Dionysus batch jobs, through the SDK. */
@Injectable()
export class BatchJobApi {
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
    publishNotification: boolean,
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
