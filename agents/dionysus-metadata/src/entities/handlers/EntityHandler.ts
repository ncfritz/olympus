import type {
  MetadataFetchJob,
  MetadataFetchJobStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable, Logger } from "@nestjs/common";
import moment, { type Moment } from "moment";
import { MetadataApi } from "@ncfritz/olympus-client";
import { FetchJobs } from "../../fetchJobs/FetchJobs";
import type { FetchJobStore } from "../../fetchJobs/FetchJobStore";
import { TERMINAL_STATUSES } from "../../fetchJobs/statuses";
import type { MetadataJobMessage } from "../../messaging";
import { TmdbClient } from "../../tmdb/services/TmdbClient";

/**
 * Fetches one entity: skips it without a pending fetch job, marks the job
 * fetching, runs doFetchMetadata() (TMDB → API) and records the outcome
 * (fetched, not_found or failed) with the entity's next refresh (TTL in
 * days, jitter in minutes).
 *
 * @typeParam T the entity as stored
 * @typeParam C what else the refresh policy needs
 */
@Injectable()
export abstract class EntityHandler<T, C> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly fetchJobs: FetchJobs,
    protected readonly tmdbClient: TmdbClient,
    protected readonly metadataApi: MetadataApi,
  ) {}

  protected async fetch(message: MetadataJobMessage): Promise<void> {
    const entityId = message.entityId;
    const jobType = message.entityType;
    const metadataManager = await this.fetchJobs.store({
      readCachingEnabled: this.shouldUseReadCache(),
      writeCachingEnabled: this.shouldUseWriteCache(),
    });

    let finalStatus: MetadataFetchJobStatus = "failed";
    let ttl: number | undefined = undefined;
    let jitter: number | undefined = undefined;
    let finishedTIme: Moment | undefined = undefined;

    try {
      this.logger.debug(`Checking for existing job.... ${entityId}:${jobType}`);

      const metadataFetchJob = await metadataManager.getMetadataFetchJob(
        entityId,
        jobType,
        message.bypassCache ?? false,
      );

      if (!metadataFetchJob) {
        this.logger.log(
          `No metadata fetch job found for ID ${entityId}/${jobType}`,
        );
        return;
      }

      if (TERMINAL_STATUSES.includes(metadataFetchJob.status)) {
        this.logger.log(
          `[${metadataFetchJob.id}]: Job in terminal status - ${metadataFetchJob.status} - aborting.`,
        );
        return;
      }

      this.logger.log(
        `[${metadataFetchJob.id}]: Found existing MetadataFetchJob in ${metadataFetchJob.status} state`,
      );

      try {
        await metadataManager.updateMetadataFetchJob(
          metadataFetchJob.id,
          metadataFetchJob.type,
          {
            status: "fetching",
          },
          false,
        );

        this.logger.debug(
          `[${metadataFetchJob.id}]: Running doFetchMetadata()`,
        );

        const [metadata, context] = await this.doFetchMetadata(
          entityId,
          metadataFetchJob,
          metadataManager,
        );
        ttl = this.getTtl(metadata, context);
        jitter = this.getJitter(metadata, context);
        finishedTIme = moment.utc();
        finalStatus = "fetched";
      } catch (e) {
        this.logger.error(
          `[${metadataFetchJob.id}]: Job failed...`,
          e instanceof Error ? e.stack : JSON.stringify(e),
        );

        if (
          e === "NotFound" ||
          (e as { status_code?: number } | undefined)?.status_code === 34
        ) {
          finalStatus = "not_found";
        } else {
          finalStatus = "failed";
        }

        finishedTIme = moment.utc();
      } finally {
        this.logger.log(`[${metadataFetchJob.id}]: Updating MetadataFetchJob`);

        await metadataManager.updateMetadataFetchJob(
          metadataFetchJob.id,
          metadataFetchJob.type,
          {
            status: finalStatus,
            ttl: ttl!,
            jitter: jitter!,
            lastFetchedTime: finishedTIme!.toISOString(),
          },
          false,
        );

        this.logger.debug(
          `[${metadataFetchJob.id}]: Cleaning up... final status ${finalStatus}`,
        );

        await this.sleep(this.randomValue(500, 2500));
      }
    } catch (e) {
      this.logger.error(
        "Metadata processing failed.",
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  protected abstract doFetchMetadata(
    entityId: string,
    metadataFetchJob: MetadataFetchJob,
    metadataManager: FetchJobStore,
  ): Promise<[T, C]>;

  /** Days until the entity is due again. */
  protected getTtl(_metadata: T, _context: C): number {
    return 14;
  }

  /** Minutes added to the TTL, to spread refreshes. */
  protected getJitter(_metadata: T, _context: C): number {
    return Math.floor(Math.random() * 3 * 24 * 60);
  }

  protected sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected randomValue(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  protected shouldUseReadCache() {
    return true;
  }

  protected shouldUseWriteCache() {
    return true;
  }
}
