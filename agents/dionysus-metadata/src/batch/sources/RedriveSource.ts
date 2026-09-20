import type {
  ListMetadataFetchJobsResponse,
  MetadataFetchJob,
} from "@ncfritz/olympus-sdk/dionysus";
import { Logger } from "@nestjs/common";
import type { JobApi } from "@ncfritz/olympus-client";
import type { MetadataFetchJobStatus, MetadataJobType } from "../../messaging";
import type { RecordSource } from "./RecordSource";

const logger = new Logger("RedriveSource");

/**
 * The metadata fetch jobs of a type in a status, scrolled a page (500) at a
 * time by the last id seen.
 */
export class RedriveSource implements RecordSource<MetadataFetchJob> {
  private lastSeenId: string | undefined = undefined;
  private jobs: MetadataFetchJob[] = [];
  private jobIndex = 0;
  private recordCount = 0;

  constructor(
    private readonly jobApi: JobApi,
    private readonly metadataType: MetadataJobType,
    private readonly status: MetadataFetchJobStatus,
  ) {}

  async init(): Promise<void> {
    logger.debug("Initializing redrive... will fetch first page of records");

    const listResponse = await this.fetchJobs();

    logger.debug(
      `Initial page contains ${listResponse.jobs.length} of ${listResponse.count} total records`,
    );

    this.jobs = listResponse.jobs;
    this.recordCount = listResponse.count;
  }

  async next(): Promise<MetadataFetchJob | undefined> {
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

    return nextEntry;
  }

  count(): number {
    return this.recordCount;
  }

  async cleanup(): Promise<void> {
    this.jobs = [];
    this.jobIndex = 0;
    this.recordCount = 0;
    this.lastSeenId = undefined;
  }

  private async fetchJobs(): Promise<ListMetadataFetchJobsResponse> {
    const listResponse = await this.jobApi.scrollMetadataFetchJobs(
      this.metadataType,
      this.status,
      this.lastSeenId,
    );
    this.jobs = listResponse.jobs;
    this.jobIndex = 0;

    return listResponse;
  }
}
