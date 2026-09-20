import {
  type BatchJob,
  createBatchJob,
  createMetadataFetchJob,
  type CreateMetadataFetchJobRequest,
  describeBatchJob,
  describeMetadataFetchJob,
  type JobType,
  type MetadataFetchJob,
  type MetadataFetchJobStatus,
  type MetadataJobType,
  type MetadatFetchJobUpdate,
  type PartialBatchJob,
  scrollMetadataFetchJobs,
  updateBatchJob,
  updateMetadataFetchJob,
} from "@ncfritz/olympus-sdk/dionysus";
import type { OlympusClients } from "../clients";
import { encodeFilters, okOrNotFound } from "../filters";

/** Dionysus batch jobs and metadata fetch jobs. */
export class JobApi {
  constructor(private readonly clients: OlympusClients) {}

  /** The batch job; undefined when there is none with this id. */
  async describeBatchJob(jobId: string): Promise<BatchJob | undefined> {
    const response = await describeBatchJob({
      client: this.clients.dionysus,
      path: { jobId },
      validateStatus: okOrNotFound,
    });
    return response.status === 404 ? undefined : response.data.job;
  }

  async createBatchJob(type: JobType, publishNotification: boolean) {
    const response = await createBatchJob({
      client: this.clients.dionysus,
      body: { type, publishNotification },
    });
    return response.data.job;
  }

  async updateBatchJob(jobId: string, job: PartialBatchJob) {
    const response = await updateBatchJob({
      client: this.clients.dionysus,
      path: { jobId },
      body: { job },
    });
    return response.data.job;
  }

  /** The entity's fetch job; undefined when it has none. */
  async describeMetadataFetchJob(
    entityId: string,
    entityType: MetadataJobType,
  ): Promise<MetadataFetchJob | undefined> {
    const response = await describeMetadataFetchJob({
      client: this.clients.dionysus,
      path: { entityId, entityType },
      validateStatus: okOrNotFound,
    });
    return response.status === 404 ? undefined : response.data.job;
  }

  async createMetadataFetchJob(job: CreateMetadataFetchJobRequest) {
    const response = await createMetadataFetchJob({
      client: this.clients.dionysus,
      body: job,
    });
    return response.data.job;
  }

  async updateMetadataFetchJob(
    entityId: string,
    entityType: MetadataJobType,
    job: MetadatFetchJobUpdate,
    publishNotification: boolean,
    bypassCache: boolean,
  ) {
    const response = await updateMetadataFetchJob({
      client: this.clients.dionysus,
      path: { entityId, entityType },
      body: { job, publishNotification, bypassCache },
    });
    return response.data.job;
  }

  /** A page of fetch jobs of one type and status, after `lastSeenId`. */
  async scrollMetadataFetchJobs(
    type: MetadataJobType,
    status: MetadataFetchJobStatus,
    lastSeenId?: string,
    pageSize = 500,
  ) {
    const response = await scrollMetadataFetchJobs({
      client: this.clients.dionysus,
      query: {
        lastSeenId,
        pageSize,
        filters: encodeFilters({ type: [type], status: [status] }),
      },
    });
    return response.data;
  }
}
