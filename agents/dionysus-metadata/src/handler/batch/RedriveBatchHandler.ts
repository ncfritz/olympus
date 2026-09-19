import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  JobStatus,
  JobType,
  ListMetadataFetchJobsResponse,
  MetadataFetchJob,
  MetadataFetchJobStatus,
  MetadataJobType,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import moment from "moment";
import metadataApi from "../../api/metadataApi";
import { type RedriveJobMessage } from "../../types/message";
import {
  BATCH_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";
import { BaseBatchHandler } from "./BaseBatchHandler";

@Injectable()
export class RedriveBatchHandler extends BaseBatchHandler {
  private metadataType: JobType;
  private status: JobStatus;
  private targetStatus: MetadataFetchJobStatus;
  private republish: boolean;

  private lastSeenId: string | undefined = undefined;
  private jobs: MetadataFetchJob[] = [];
  private jobIndex = 0;
  private recordCount = 0;

  @RabbitSubscribe({
    exchange: `${BATCH_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${BATCH_JOB_PREFIX}.redrive.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.redrive`,
    queueOptions: {
      channel: "batchJobsChannel",
      arguments: {
        "x-consumer-timeout": 3 * 60 * 60 * 1000, // 4h in ms
      },
    },
  })
  public async handle(message: RedriveJobMessage, amqpMessage: ConsumeMessage) {
    this.metadataType = message.jobType;
    this.status = message.status || "failed";
    this.targetStatus = message.targetStatus;
    this.republish = message.republish || false;

    return await this.doFetch(message, amqpMessage);
  }

  protected async cleanup(): Promise<void> {
    this.jobs = [];
    this.jobIndex = 0;
    this.recordCount = 0;
    this.lastSeenId = undefined;
  }

  protected getRecordCount(): number {
    return this.recordCount;
  }

  protected shouldPublishNotifications(): boolean {
    return this.republish;
  }

  protected shouldBypassCacheOnPublish(): boolean {
    return true;
  }

  protected shouldIgnoreStaleCheck(): boolean {
    return true;
  }

  protected shouldUseReadCache() {
    return false;
  }

  protected shouldUseWriteCache() {
    return false;
  }

  protected async preCreateMetadataFetchJob(
    _id: string,
    _type: string,
    _line: any,
  ): Promise<MetadataFetchJobStatus> {
    return this.targetStatus;
  }

  protected async preUpdateMetadataFetchJob(
    _id: string,
    _type: string,
    _line: any,
  ): Promise<MetadataFetchJobStatus> {
    return this.targetStatus;
  }

  protected async init(_initTime: moment.Moment): Promise<void> {
    logger.debug("Initializing redrive... will fetch first page of records");

    const listResponse = await this.fetchJobs();

    logger.debug(
      `Initial page contains ${listResponse.jobs.length} of ${listResponse.count} total records`,
    );

    this.jobs = listResponse.jobs;
    this.recordCount = listResponse.count;
  }

  protected async nextRecord(): Promise<string | undefined> {
    // If the job list is empty, bail
    if (this.jobs && this.jobs.length <= 0) {
      logger.debug("No records in page... exiting nextRecord()");

      return undefined;
    }

    const nextIndex = this.jobIndex + 1;

    // If the next index is past the end of the existing job list, we will trigger a paging event.
    // Get the next page of jobs to process.  Note: the list may possibly be empty, if that is the case,
    // return undefined to signal the end of processing.
    if (nextIndex > this.jobs.length) {
      logger.debug(
        `Scrolling - jobs in page ${this.jobs.length}, lastSeenId ${this.lastSeenId}`,
      );

      // Fetch the new list - this will reset the jobIndex to 0
      await this.fetchJobs();

      // Check the job list again, since it was just fetched. If the job list is empty, bail
      if (this.jobs && this.jobs.length <= 0) {
        return undefined;
      }
    }

    const nextEntry = this.jobs[this.jobIndex];
    // Update the lastSeenId so we can scroll
    this.lastSeenId = nextEntry.id;
    this.jobIndex++;

    return JSON.stringify(nextEntry);
  }

  private async fetchJobs(): Promise<ListMetadataFetchJobsResponse> {
    const listResponse = await metadataApi.scrollMetadataFetchJobs(
      this.metadataType as MetadataJobType,
      this.status,
      this.lastSeenId,
    );
    this.jobs = listResponse.jobs;
    this.jobIndex = 0;

    return listResponse;
  }
}
