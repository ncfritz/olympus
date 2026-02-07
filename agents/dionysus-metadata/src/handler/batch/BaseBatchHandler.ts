import { AmqpConnection, SubscribeResponse } from "@golevelup/nestjs-rabbitmq";
import {
  BatchJob,
  MetadataFetchJob,
  MetadataFetchJobStatus,
  MetadatFetchJobUpdate,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Message } from "amqplib";
import moment, { Moment } from "moment";
import batchJobApi from "../../api/batchJobApi";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { SqliteCacheManager } from "../../cache/SqliteCacheManager";
import { BatchJobMessage } from "../../types/message";
import {
  BATCH_JOB_WORKFLOW_EXCHANGE,
  TERMINAL_STATUSES,
} from "../../util/constants";
import { addExecution, removeExecution } from "../../util/executionHolder";
import { logger } from "../../util/logger";
import { sendBatchJobNotification } from "../../util/notification";

const DEFAULT_TTL = 30;

@Injectable()
export abstract class BaseBatchHandler {
  constructor(
    protected readonly amqpConnection: AmqpConnection,
    protected readonly configService: ConfigService,
  ) {
    this.amqpConnection = amqpConnection;
    this.configService = configService;
  }

  protected async doFetch(
    message: BatchJobMessage,
    amqpMessage: Message,
  ): Promise<SubscribeResponse> {
    let job = await batchJobApi.getBatchJob(message.jobId);
    addExecution({ id: job.id, type: "batch" });

    if (!job) {
      logger.info("No job record found, aborting");
      return;
    }

    if (job.status !== "created") {
      logger.info(
        `Found existing job in non-CREATED state - ${job.status}, bailing...`,
      );
      return;
    }

    const metadataManager = new MetadataFetchJobManager(
      new SqliteCacheManager({
        cacheLocation: this.configService.get<string>(
          "DIONYSUS_CACHE_PATH",
          "",
        ),
      }),
      {
        readCachingEnabled: this.shouldUseReadCache(),
        writeCachingEnabled: this.shouldUseWriteCache(),
      },
    );
    await metadataManager.init();

    let processedRecordsCount = 0;
    let newRecordCount = 0;
    let noOpRecordCount = 0;
    let expiredRecordCount = 0;
    let duplicateRecordCount = 0;
    let skippedRecordCount = 0;

    try {
      logger.debug("Initializing handler....");
      const jobType = message.jobType;
      const offset = message.offset;
      const maxRecords = message.max || Number.MAX_VALUE;
      const now = moment.utc().subtract(8, "hours");
      await this.init(now);

      job.status = "started";
      job.totalRecords = this.getRecordCount();
      job.startedTime = moment.utc().toISOString();

      job = await batchJobApi.updateBatchJob(job.id, job);
      let lastCheckpointTime = moment.utc();

      let line;
      let count = 0;

      if (offset > 0) {
        logger.info(`Found non-zero offset, will skip ${offset} records...`);

        for (let i = 0; i < offset; i++) {
          await this.nextRecord();
          skippedRecordCount++;
          processedRecordsCount++;
          count++;
        }
      }

      while ((line = await this.nextRecord()) && count - offset <= maxRecords) {
        count++;

        const lineJson = JSON.parse(line);
        const jobId = this.getJobId(lineJson);

        logger.info(
          `[${count}]: Checking for existing job.... ${jobId}:${jobType}`,
        );

        const metadataFetchJob = await metadataManager.getMetadataFetchJob(
          jobId,
          jobType,
          message.bypassCache,
        );

        if (metadataFetchJob) {
          logger.debug(
            `[${count}]: Found existing MetadataFetchJob - ${metadataFetchJob.id}`,
          );
          const lastFetchedTime = metadataFetchJob.lastFetchedTime;

          if (
            !lastFetchedTime &&
            TERMINAL_STATUSES.includes(metadataFetchJob.status) &&
            !this.shouldIgnoreStaleCheck()
          ) {
            logger.info(
              `[${count}]: Metadata has not been fetched, marking as duplicate - ${metadataFetchJob.id}`,
              {
                id: metadataFetchJob.id,
                type: metadataFetchJob.type,
                lastFetchedTime: metadataFetchJob.lastFetchedTime,
                ignoreStaleCheck: this.shouldIgnoreStaleCheck(),
              },
            );
            logger.debug("Retrieved MetadataFetchJob", {
              job: metadataFetchJob,
            });

            duplicateRecordCount++;
          } else {
            const expirationTime = moment(lastFetchedTime as unknown as string)
              .add(metadataFetchJob.ttl, "days")
              .add(metadataFetchJob.jitter, "minutes");

            if (expirationTime.isBefore(now) || this.shouldIgnoreStaleCheck()) {
              logger.info(
                `[${count}]: Record is expired, or expiration check is bypassed... re-processing - re-queue: ${this.shouldPublishNotifications()}`,
              );

              if (!this.shouldIgnoreStaleCheck()) {
                expiredRecordCount++;
              }

              const jobStatus = await this.preUpdateMetadataFetchJob(
                metadataFetchJob.id,
                jobType,
                metadataFetchJob.status,
                lineJson,
              );

              logger.debug(
                `[${count}]: Record status will be set to ${jobStatus}`,
              );

              const jobUpdates: MetadatFetchJobUpdate = {
                status: jobStatus,
              };

              if (jobStatus === "fetched") {
                jobUpdates.lastFetchedTime = moment.utc().toISOString();
              }

              // Update the TTL and jitter only when the record is invalidated
              if (metadataFetchJob.status === "invalidated") {
                jobUpdates.ttl = this.getTtl();
                jobUpdates.jitter = this.getJitter();
              }

              logger.debug(
                `[${count}]: Updating job ${metadataFetchJob.id}...`,
                {
                  updates: jobUpdates,
                },
              );

              const updatedMetadataFetchJob =
                await metadataManager.updateMetadataFetchJob(
                  metadataFetchJob.id,
                  metadataFetchJob.type,
                  jobUpdates,
                  this.shouldPublishNotifications(),
                  this.shouldBypassCacheOnPublish(),
                );

              await this.postUpdateMetadataFetchJob(
                metadataFetchJob.id,
                jobType,
                lineJson,
                updatedMetadataFetchJob,
              );
            } else {
              logger.debug(`[${count}]: Record is fresh, no-op`);
              noOpRecordCount++;
            }
          }
        } else {
          const jobStatus = await this.preCreateMetadataFetchJob(
            jobId,
            jobType,
            lineJson,
          );

          const createdMetadataFetchJob =
            await metadataManager.createMetadataFetchJob(
              jobId,
              jobType,
              this.getTtl(),
              this.getJitter(),
              jobStatus,
              this.shouldPublishNotifications(),
            );
          await this.postCreateMetadataFetchJob(
            jobId,
            jobType,
            lineJson,
            createdMetadataFetchJob,
          );

          newRecordCount++;
        }

        processedRecordsCount++;

        const recordExecutionTime = moment.utc();

        if (recordExecutionTime.diff(lastCheckpointTime, "seconds") > 10) {
          job.processedRecords = processedRecordsCount;
          job.newRecords = newRecordCount;
          job.noOpRecords = noOpRecordCount;
          job.duplicateRecords = duplicateRecordCount;
          job.expiredRecords = expiredRecordCount;
          job.skippedRecords = skippedRecordCount;
          await batchJobApi.updateBatchJob(job.id, job);

          lastCheckpointTime = moment.utc();
        }

        await this.sleep(this.getBackoff());
      }

      job.status = "success";
    } catch (e) {
      logger.error(`Processing failed...`, e);
      job.status = "failed";
    } finally {
      job.processedRecords = processedRecordsCount;
      job.newRecords = newRecordCount;
      job.noOpRecords = noOpRecordCount;
      job.duplicateRecords = duplicateRecordCount;
      job.expiredRecords = expiredRecordCount;
      job.skippedRecords = skippedRecordCount;
      job.finishedTime = moment.utc().toISOString();

      logger.info(`Finalizing job ${job.id}`);
      logger.info("Final job statistics:", {
        processed: processedRecordsCount,
        new: newRecordCount,
        "no-op": noOpRecordCount,
        duplicate: duplicateRecordCount,
        expired: expiredRecordCount,
        skipped: skippedRecordCount,
      });

      removeExecution(job.id);
      await batchJobApi.updateBatchJob(job.id, job);
      await this.cleanup();
      await metadataManager.close();
      await this.signalWorkflow(job, message);
      await sendBatchJobNotification(job, message.workflowId);
    }

    return;
  }

  private async signalWorkflow(
    job: BatchJob,
    msg: BatchJobMessage,
  ): Promise<void> {
    if (!msg.workflowId || !msg.stepId) {
      logger.info(
        "No workflow ID associated with current job, nothing to do...",
      );
      return;
    }

    try {
      const message = {
        jobId: job.id,
        jobType: job.type,
        status: job.status,
        workflowId: msg.workflowId,
        stepId: msg.stepId,
        attempt: msg.attempt || 0,
        recordsProcessed: job.processedRecords,
      };

      await this.amqpConnection.publish(
        BATCH_JOB_WORKFLOW_EXCHANGE,
        "jobCompletion",
        message,
        {
          persistent: true,
          headers: {
            "x-delay": 10000,
          },
        },
      );

      logger.info(`Workflow notification sent for job ID: ${job.id}`);
    } catch (e) {
      logger.warn(
        `Unable to send workflow notification for job ID: ${job?.id}`,
        e,
      );
    }
  }

  protected abstract init(initTime: Moment): Promise<void>;
  protected abstract nextRecord(): Promise<string | undefined>;
  protected abstract getRecordCount(): number;

  protected async cleanup(): Promise<void> {}

  protected getJobId(line: any): string {
    return String(line.id);
  }

  protected getTtl(): number {
    return DEFAULT_TTL;
  }

  protected getJitter(): number {
    return Math.floor(Math.random() * 3 * 24 * 60);
  }

  protected getBackoff(): number {
    return 0;
  }

  protected shouldPublishNotifications(): boolean {
    return true;
  }

  protected shouldBypassCacheOnPublish(): boolean {
    return false;
  }

  protected shouldUseReadCache() {
    return true;
  }

  protected shouldUseWriteCache() {
    return true;
  }

  protected shouldIgnoreStaleCheck(): boolean {
    return false;
  }

  protected async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  protected async preUpdateMetadataFetchJob(
    id: string,
    type: string,
    currentStatus: MetadataFetchJobStatus,
    line: any,
  ): Promise<MetadataFetchJobStatus> {
    switch (currentStatus) {
      case "invalidated":
        return "queued";
      default:
        return "invalidated";
    }
  }

  protected async postUpdateMetadataFetchJob(
    id: string,
    type: string,
    line: any,
    job: MetadataFetchJob,
  ): Promise<void> {
    // Do nothing - override me
  }

  protected async preCreateMetadataFetchJob(
    id: string,
    type: string,
    line: any,
  ): Promise<MetadataFetchJobStatus> {
    return "queued";
  }

  protected async postCreateMetadataFetchJob(
    id: string,
    type: string,
    line: any,
    job: MetadataFetchJob,
  ): Promise<void> {
    // Do nothing - override me
  }
}
