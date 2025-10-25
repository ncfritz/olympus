import {
  client,
  createBatchJob,
  createRedriveJob,
  deleteBatchJob,
  getBatchJobStats,
  getBatchJobStatsByType,
  type JobType,
  listBatchJobs,
  listBatchJobsByType,
  type MetadataFetchJobStatus,
  type MetadataJobType,
  type PartialBatchJob,
  type FilterDefinition,
  updateBatchJob,
} from "@ncfritz/olympus-sdk/dionysus";
import { ApiBase } from "./apiBase";
import type { SortOptions } from "./common";

class BatchJobApi extends ApiBase {
  constructor() {
    super();
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async createBatchJob(
    type: JobType,
    publishNotification: boolean,
    skipRecords = 0,
    maxRecordsToProcess?: number,
  ) {
    return await createBatchJob({
      body: {
        type: type,
        publishNotification: publishNotification,
        offset: skipRecords,
        maxRecordsToProcess: maxRecordsToProcess,
      },
    });
  }

  async deleteBatchJob(id: string) {
    return await deleteBatchJob({
      path: {
        jobId: id,
      },
    });
  }

  async listBatchJobs(
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    return await listBatchJobs({
      query: {
        pageSize: pageSize,
        sort: sort.order,
        sortBy: sort.field,
        startPage: page,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async listBatchJobsByType(
    type: JobType,
    page: number,
    pageSize: number,
    sort: SortOptions,
    filters?: FilterDefinition,
  ) {
    console.log(filters);
    return await listBatchJobsByType({
      path: {
        jobType: type,
      },
      query: {
        pageSize: pageSize,
        startPage: page,
        sort: sort.order,
        sortBy: sort.field,
        filters: this.encodeFilters(filters),
      },
    });
  }

  async createBatchRedriveJob(
    metadataType: MetadataJobType,
    status: MetadataFetchJobStatus,
    targetStatus: MetadataFetchJobStatus,
    publishNotification: boolean,
  ) {
    return await createRedriveJob({
      body: {
        metadataType: metadataType,
        status: status,
        targetStatus: targetStatus,
        publishNotification: publishNotification,
      },
    });
  }

  async getBatchJobStats() {
    return await getBatchJobStats();
  }

  async getBatchJobStatsByType(type: JobType) {
    return await getBatchJobStatsByType({
      path: {
        jobType: type,
      },
    });
  }

  async updateBatchJob(id: string, job: PartialBatchJob) {
    return await updateBatchJob({
      path: {
        jobId: id,
      },
      body: {
        job: job,
      },
    });
  }
}

const batchJobApi = new BatchJobApi();
export default batchJobApi;
