import type {
  MetadataFetchJob,
  MetadataFetchJobStatus,
  MetadataJobType,
  MetadatFetchJobUpdate,
} from "@ncfritz/olympus-sdk/dionysus";
import type { JobApi } from "@ncfritz/olympus-client";
import moment from "moment";
import type { FetchJobCache } from "./FetchJobCache";

export type FetchJobStoreOptions = {
  readCachingEnabled: boolean;
  writeCachingEnabled: boolean;
};

/**
 * Metadata fetch jobs through the local cache: reads try the cache first
 * (unless bypassed), and what the API returns is written back.
 */
export class FetchJobStore {
  private readonly readCachingEnabled: boolean;
  private readonly writeCachingEnabled: boolean;

  constructor(
    private readonly cache: FetchJobCache,
    private readonly jobApi: JobApi,
    options: FetchJobStoreOptions,
  ) {
    this.readCachingEnabled = options.readCachingEnabled;
    this.writeCachingEnabled = options.writeCachingEnabled;
  }

  async getMetadataFetchJob(
    entityId: string,
    jobType: MetadataJobType,
    bypassCache: boolean,
  ): Promise<MetadataFetchJob | undefined> {
    let metadataFetchJob: MetadataFetchJob | undefined;
    const key = `${jobType}:${entityId}`;

    if (this.readCachingEnabled && !bypassCache) {
      metadataFetchJob = await this.cache.get(key);
    }

    if (!metadataFetchJob) {
      metadataFetchJob = await this.jobApi.describeMetadataFetchJob(
        entityId,
        jobType,
      );

      if (this.writeCachingEnabled && metadataFetchJob) {
        await this.cache.put(key, metadataFetchJob);
      }
    }

    return metadataFetchJob;
  }

  async createMetadataFetchJob(
    entityId: string,
    jobType: MetadataJobType,
    ttl: number,
    jitter: number,
    status: MetadataFetchJobStatus,
    publishNotification: boolean,
    context?: Record<string, unknown>,
  ): Promise<MetadataFetchJob> {
    const metadataFetchJob = await this.jobApi.createMetadataFetchJob({
      id: entityId,
      type: jobType,
      ttl,
      jitter,
      status,
      lastFetchedTime:
        status === "fetched" ? moment.utc().toISOString() : undefined,
      publishNotification,
      context,
    });

    if (this.writeCachingEnabled && metadataFetchJob) {
      const key = `${jobType}:${entityId}`;
      await this.cache.put(key, metadataFetchJob);
    }

    return metadataFetchJob;
  }

  async updateMetadataFetchJob(
    entityId: string,
    jobType: MetadataJobType,
    updates: MetadatFetchJobUpdate,
    publishNotification: boolean,
    bypassCache?: boolean,
  ): Promise<MetadataFetchJob> {
    const metadataFetchJob = await this.jobApi.updateMetadataFetchJob(
      entityId,
      jobType,
      updates,
      publishNotification,
      bypassCache || false,
    );

    if (this.writeCachingEnabled && metadataFetchJob) {
      const key = `${jobType}:${entityId}`;
      await this.cache.put(key, metadataFetchJob);
    }

    return metadataFetchJob;
  }
}
