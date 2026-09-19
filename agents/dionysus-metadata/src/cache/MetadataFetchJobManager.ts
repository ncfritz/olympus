import {
  MetadataFetchJob,
  MetadataFetchJobStatus,
  MetadataJobType,
  MetadatFetchJobUpdate,
} from "@ncfritz/olympus-sdk/dionysus";
import metadataApi from "../api/metadataApi";
import { CacheManager } from "./CacheManager";

export type MetadataFetchJobManagerProps = {
  readCachingEnabled: boolean;
  writeCachingEnabled: boolean;
};

export class MetadataFetchJobManager {
  private cache: CacheManager;
  private readonly readCachingEnabled: boolean;
  private readonly writeCachingEnabled: boolean;

  constructor(
    cacheManager: CacheManager,
    options: MetadataFetchJobManagerProps,
  ) {
    this.cache = cacheManager;
    this.readCachingEnabled = options.readCachingEnabled;
    this.writeCachingEnabled = options.writeCachingEnabled;
  }

  async init() {
    await this.cache.init();
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
      metadataFetchJob = await metadataApi.getMetadataFetchJob(
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
    const metadataFetchJob = await metadataApi.createMetadataFetchJob(
      entityId,
      jobType,
      ttl,
      jitter,
      status,
      publishNotification,
      context,
    );

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
    const metadataFetchJob = await metadataApi.updateMetadataFetchJob(
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

  async close() {
    await this.cache.close();
  }
}
