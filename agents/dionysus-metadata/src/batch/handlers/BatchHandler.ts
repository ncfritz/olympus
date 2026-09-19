import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { delayed, publishMessage } from "@ncfritz/olympus-messages";
import type {
  BatchJob,
  MetadataFetchJob,
  MetadatFetchJobUpdate,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable, Logger } from "@nestjs/common";
import moment from "moment";
import { BatchJobApi } from "../../api/BatchJobApi";
import { MetadataApi } from "../../api/MetadataApi";
import { FetchJobs } from "../../fetchJobs/FetchJobs";
import { TERMINAL_STATUSES } from "../../fetchJobs/statuses";
import {
  BATCH_JOB_COMPLETION_ROUTE,
  type BatchJobCompletionMessage,
  type BatchJobMessage,
  type MetadataFetchJobStatus,
} from "../../messaging";
import { TmdbClient } from "../../tmdb/services/TmdbClient";
import { ExecutionRegistry } from "../../workflow/services/ExecutionRegistry";
import { JobNotifier } from "../../workflow/services/JobNotifier";
import type { RecordSource } from "../sources/RecordSource";

const DEFAULT_TTL = 30;

/**
 * A batch job: goes through a source's records (TMDB exports and lists, or
 * fetch jobs to redrive) and creates or refreshes a metadata fetch job for
 * each; new and expired ones are queued for fetching (or stored right away
 * by the reference-list jobs). Records progress on the batch job every 10
 * seconds, and reports completion to the job's workflow.
 *
 * Subclasses pick the source and the policy hooks below.
 */
@Injectable()
export abstract class BatchHandler<
  R,
  M extends BatchJobMessage = BatchJobMessage,
> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly amqpConnection: AmqpConnection,
    protected readonly batchJobApi: BatchJobApi,
    protected readonly metadataApi: MetadataApi,
    protected readonly tmdbClient: TmdbClient,
    protected readonly fetchJobs: FetchJobs,
    protected readonly executions: ExecutionRegistry,
    protected readonly jobNotifier: JobNotifier,
  ) {}

  /** The records of one run of the job in `message`. */
  protected abstract createSource(message: M): RecordSource<R>;

  protected async run(message: M): Promise<void> {
    let job = await this.batchJobApi.getBatchJob(message.jobId);
    this.executions.add({ id: job.id, type: "batch" });

    if (!job) {
      this.logger.log("No job record found, aborting");
      return;
    }

    if (job.status !== "created") {
      this.logger.log(
        `Found existing job in non-CREATED state - ${job.status}, bailing...`,
      );
      return;
    }

    const metadataManager = await this.fetchJobs.store({
      readCachingEnabled: this.shouldUseReadCache(),
      writeCachingEnabled: this.shouldUseWriteCache(),
    });
    const source = this.createSource(message);

    let processedRecordsCount = 0;
    let newRecordCount = 0;
    let noOpRecordCount = 0;
    let expiredRecordCount = 0;
    let duplicateRecordCount = 0;
    let skippedRecordCount = 0;

    try {
      this.logger.debug("Initializing handler....");
      const jobType = message.jobType;
      const offset = message.offset;
      const maxRecords = message.max || Number.MAX_VALUE;
      const now = moment.utc().subtract(8, "hours");
      await source.init(now);

      job.status = "started";
      job.totalRecords = source.count();
      job.startedTime = moment.utc().toISOString();

      job = await this.batchJobApi.updateBatchJob(job.id, job);
      let lastCheckpointTime = moment.utc();

      let record: R | undefined;
      let count = 0;

      if (offset > 0) {
        this.logger.log(
          `Found non-zero offset, will skip ${offset} records...`,
        );

        for (let i = 0; i < offset; i++) {
          await source.next();
          skippedRecordCount++;
          processedRecordsCount++;
          count++;
        }
      }

      while ((record = await source.next()) && count - offset <= maxRecords) {
        count++;

        const jobId = this.getJobId(record);

        this.logger.log(
          `[${count}]: Checking for existing job.... ${jobId}:${jobType}`,
        );

        const metadataFetchJob = await metadataManager.getMetadataFetchJob(
          jobId,
          jobType,
          message.bypassCache ?? false,
        );

        if (metadataFetchJob) {
          this.logger.debug(
            `[${count}]: Found existing MetadataFetchJob - ${metadataFetchJob.id}`,
          );
          const lastFetchedTime = metadataFetchJob.lastFetchedTime;

          if (
            !lastFetchedTime &&
            TERMINAL_STATUSES.includes(metadataFetchJob.status) &&
            !this.shouldIgnoreStaleCheck()
          ) {
            this.logger.log(
              `[${count}]: Metadata has not been fetched, marking as duplicate - ${metadataFetchJob.id}`,
              {
                id: metadataFetchJob.id,
                type: metadataFetchJob.type,
                lastFetchedTime: metadataFetchJob.lastFetchedTime,
                ignoreStaleCheck: this.shouldIgnoreStaleCheck(),
              },
            );
            this.logger.debug("Retrieved MetadataFetchJob", {
              job: metadataFetchJob,
            });

            duplicateRecordCount++;
          } else {
            const expirationTime = moment(lastFetchedTime as unknown as string)
              .add(metadataFetchJob.ttl, "days")
              .add(metadataFetchJob.jitter, "minutes");

            if (expirationTime.isBefore(now) || this.shouldIgnoreStaleCheck()) {
              this.logger.log(
                `[${count}]: Record is expired, or expiration check is bypassed... re-processing - re-queue: ${this.shouldPublishNotifications(message)}`,
              );

              if (!this.shouldIgnoreStaleCheck()) {
                expiredRecordCount++;
              }

              const jobStatus = await this.preUpdateMetadataFetchJob(
                metadataFetchJob.id,
                jobType,
                metadataFetchJob.status,
                record,
                message,
              );

              this.logger.debug(
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

              this.logger.debug(
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
                  this.shouldPublishNotifications(message),
                  this.shouldBypassCacheOnPublish(),
                );

              await this.postUpdateMetadataFetchJob(
                metadataFetchJob.id,
                jobType,
                record,
                updatedMetadataFetchJob,
              );
            } else {
              this.logger.debug(`[${count}]: Record is fresh, no-op`);
              noOpRecordCount++;
            }
          }
        } else {
          const jobStatus = await this.preCreateMetadataFetchJob(
            jobId,
            jobType,
            record,
            message,
          );

          const createdMetadataFetchJob =
            await metadataManager.createMetadataFetchJob(
              jobId,
              jobType,
              this.getTtl(),
              this.getJitter(),
              jobStatus,
              this.shouldPublishNotifications(message),
            );
          await this.postCreateMetadataFetchJob(
            jobId,
            jobType,
            record,
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
          await this.batchJobApi.updateBatchJob(job.id, job);

          lastCheckpointTime = moment.utc();
        }

        await this.sleep(this.getBackoff());
      }

      job.status = "success";
    } catch (e) {
      this.logger.error(
        "Processing failed...",
        e instanceof Error ? e.stack : String(e),
      );
      job.status = "failed";
    } finally {
      job.processedRecords = processedRecordsCount;
      job.newRecords = newRecordCount;
      job.noOpRecords = noOpRecordCount;
      job.duplicateRecords = duplicateRecordCount;
      job.expiredRecords = expiredRecordCount;
      job.skippedRecords = skippedRecordCount;
      job.finishedTime = moment.utc().toISOString();

      this.logger.log(`Finalizing job ${job.id}`);
      this.logger.log("Final job statistics:", {
        processed: processedRecordsCount,
        new: newRecordCount,
        "no-op": noOpRecordCount,
        duplicate: duplicateRecordCount,
        expired: expiredRecordCount,
        skipped: skippedRecordCount,
      });

      this.executions.remove(job.id);
      await this.batchJobApi.updateBatchJob(job.id, job);
      await source.cleanup();
      await this.signalWorkflow(job, message);
      await this.jobNotifier.sendBatchJobNotification(job, message.workflowId);
    }
  }

  private async signalWorkflow(job: BatchJob, msg: M): Promise<void> {
    if (!msg.workflowId || !msg.stepId) {
      this.logger.log(
        "No workflow ID associated with current job, nothing to do...",
      );
      return;
    }

    try {
      const message: BatchJobCompletionMessage = {
        jobId: job.id,
        jobType: job.type,
        status: job.status,
        workflowId: msg.workflowId,
        stepId: msg.stepId,
        attempt: msg.attempt || 0,
        recordsProcessed: job.processedRecords ?? 0,
      };

      await publishMessage(
        this.amqpConnection,
        BATCH_JOB_COMPLETION_ROUTE,
        message,
        delayed(10000),
      );

      this.logger.log(`Workflow notification sent for job ID: ${job.id}`);
    } catch (e) {
      this.logger.warn(
        `Unable to send workflow notification for job ID: ${job?.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  protected getJobId(record: R): string {
    return String((record as { id: unknown }).id);
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

  protected shouldPublishNotifications(_message: M): boolean {
    return true;
  }

  protected shouldBypassCacheOnPublish(): boolean {
    return false;
  }

  protected shouldUseReadCache(): boolean {
    return true;
  }

  protected shouldUseWriteCache(): boolean {
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

  /** The status of an existing, expired fetch job. */
  protected async preUpdateMetadataFetchJob(
    _id: string,
    _type: string,
    currentStatus: MetadataFetchJobStatus,
    _record: R,
    _message: M,
  ): Promise<MetadataFetchJobStatus> {
    switch (currentStatus) {
      case "invalidated":
        return "queued";
      default:
        return "invalidated";
    }
  }

  protected async postUpdateMetadataFetchJob(
    _id: string,
    _type: string,
    _record: R,
    _job: MetadataFetchJob,
  ): Promise<void> {
    // Do nothing - override me
  }

  /** The status of a new fetch job. */
  protected async preCreateMetadataFetchJob(
    _id: string,
    _type: string,
    _record: R,
    _message: M,
  ): Promise<MetadataFetchJobStatus> {
    return "queued";
  }

  protected async postCreateMetadataFetchJob(
    _id: string,
    _type: string,
    _record: R,
    _job: MetadataFetchJob,
  ): Promise<void> {
    // Do nothing - override me
  }
}
