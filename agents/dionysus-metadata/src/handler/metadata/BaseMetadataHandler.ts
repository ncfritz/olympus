import {
  MetadataFetchJob,
  MetadataFetchJobStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import moment, { Moment } from "moment";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { SqliteCacheManager } from "../../cache/SqliteCacheManager";
import { MetadataJobMessage } from "../../types/message";
import { TERMINAL_STATUSES } from "../../util/constants";
import { logger } from "../../util/logger";

@Injectable()
export abstract class BaseMetadataHandler<T, C> {
  constructor(protected readonly configService: ConfigService) {
    this.configService = configService;
  }

  protected async doFetch(message: MetadataJobMessage) {
    const entityId = message.entityId;
    const jobType = message.entityType;
    const metadataManager = new MetadataFetchJobManager(
      new SqliteCacheManager({
        cacheLocation: this.configService.get<string>("DIONYSUS_CACHE_PATH")!,
      }),
      {
        readCachingEnabled: this.shouldUseReadCache(),
        writeCachingEnabled: this.shouldUseWriteCache(),
      },
    );
    await metadataManager.init();

    let finalStatus: MetadataFetchJobStatus = "failed";
    let ttl: number | undefined = undefined;
    let jitter: number | undefined = undefined;
    let finishedTIme: Moment | undefined = undefined;

    try {
      logger.debug(`Checking for existing job.... ${entityId}:${jobType}`);

      const metadataFetchJob = await metadataManager.getMetadataFetchJob(
        entityId,
        jobType,
        message.bypassCache,
      );

      if (!metadataFetchJob) {
        logger.info(
          `No metadata fetch job found for ID ${entityId}/${jobType}`,
        );
        return;
      }

      if (TERMINAL_STATUSES.includes(metadataFetchJob.status)) {
        logger.info(
          `[${metadataFetchJob.id}]: Job in terminal status - ${metadataFetchJob.status} - aborting.`,
        );
        return;
      }

      logger.info(
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

        logger.debug(`[${metadataFetchJob.id}]: Running doFetchMetadata()`, {
          entityId: entityId,
        });

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
        logger.error(`[${metadataFetchJob.id}]: Job failed...`, e);

        if (e === "NotFound" || e.status_code === 34) {
          finalStatus = "not_found";
        } else {
          finalStatus = "failed";
        }

        finishedTIme = moment.utc();
      } finally {
        logger.info(`[${metadataFetchJob.id}]: Updating MetadataFetchJob`, {
          entityId: metadataFetchJob.id,
        });

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

        logger.debug(
          `[${metadataFetchJob.id}]: Cleaning up... final status ${finalStatus}`,
          {
            entityId: metadataFetchJob.id,
          },
        );
        await this.cleanup();

        await this.sleep(this.randomValue(500, 2500));
      }
    } catch (e) {
      logger.error(`Metadata processing failed.`, e);
    } finally {
      await metadataManager.close();
    }
  }

  protected abstract doFetchMetadata(
    entityId: string,
    metadataFetchJob: MetadataFetchJob,
    metadataManager: MetadataFetchJobManager,
  ): Promise<[T, C]>;
  protected abstract cleanup(): Promise<void>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getTtl(metadata: T, context: C): number {
    return 14;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getJitter(metadata: T, context: C): number {
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
