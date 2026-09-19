import {
  batchJobRoute,
  type MessageRoute,
  type MetadataJobType as MessageMetadataJobType,
  publishMessage,
  REDRIVE_JOB_ROUTE,
} from "@ncfritz/olympus-messages";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  BatchJob,
  BatchJobRecordStats,
  CreateBatchJobRequest,
  CreateRedriveJobRequest,
  FilterDefinition,
  FilterType,
  GetBatchJobStatsByTypeResponse,
  GetBatchJobStatsResponse,
  JobStatus,
  JobType,
  MetadataJobType,
  PartialBatchJob,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment, { Moment } from "moment";
import {
  BATCH_JOB_STATUSES_MAP,
  METADATA_CATEGORY_MAP,
} from "../../../../utils/constants";
import {
  dailyIndex,
  emptyDailySeries,
  startOfTodayUtc,
} from "../../../../utils/dailySeries";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
  parseFilterDefinition,
} from "../../../../utils/filterUtil";
import {
  GraphQlBatchJob,
  GraphQlBulkLoadJobStat,
  GraphQlBulkLoadJobStatusStat,
  GraphQlListBatchJobsResponse,
} from "../../types/batchJobs";
import { toDomainObject } from "../converters/BatchJobConverter";
import {
  BASE_BATCH_JOB,
  BATCH_JOB,
  BATCH_JOB_STATISTICS,
} from "../queries/batchJobs";
import { JOB_STATUS_STATISTICS } from "../../queries/statistics";

type GraphQlCreateBatchJobResponse = {
  insert_dionysus_bulk_load_jobs_one: GraphQlBatchJob;
};

type GraphQlGetBatchJobResponse = {
  dionysus_bulk_load_jobs_by_pk: GraphQlBatchJob;
};

type GraphQlUpdateMetadataFetchJobResponse = {
  update_dionysus_bulk_load_jobs_by_pk: GraphQlBatchJob | null;
};

type GraphQlDeleteBatchJobResponse = {
  delete_dionysus_bulk_load_jobs_by_pk: { id: string } | null;
};

type GraphQlBatchJobStatisticsResponse = {
  dionysus_bulk_load_jobs_statistics: GraphQlBulkLoadJobStat[];
  dionysus_bulk_load_jobs_status_statistics: GraphQlBulkLoadJobStatusStat[];
};

type GraphQlBatchJobStatisticsByTypeResponse = {
  dionysus_bulk_load_jobs_statistics: GraphQlBulkLoadJobStat[];
};

/** A page of batch jobs and the total number of matching jobs. */
export type BatchJobPage = { jobs: BatchJob[]; count: number };

const emptySeriesPerType = (
  today: Moment,
): Record<MetadataJobType, number[][]> =>
  Object.fromEntries(
    Object.values(MetadataJobType).map((type) => [
      type,
      emptyDailySeries(today),
    ]),
  ) as Record<MetadataJobType, number[][]>;

/** Dionysus batch (bulk load) jobs in Hasura, and their trigger messages. */
@Injectable()
export class BatchJobService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  /** Creates a batch job and, unless disabled, publishes its trigger. */
  async create(request: CreateBatchJobRequest): Promise<BatchJob> {
    // CreateBatchJob starts metadata job types; redrive has its own
    // operation (CreateRedriveJob).
    const jobType = request.type as MessageMetadataJobType;
    return this.createJob(
      request.type,
      request.publishNotification ?? true,
      batchJobRoute(jobType),
      (job) => ({
        jobType: job.type as MessageMetadataJobType,
        jobId: job.id,
        offset: request.offset ?? 0,
        max: request.maxRecordsToProcess,
      }),
    );
  }

  /** Creates a redrive job and publishes its trigger. */
  async createRedrive(request: CreateRedriveJobRequest): Promise<BatchJob> {
    return this.createJob(JobType.REDRIVE, true, REDRIVE_JOB_ROUTE, (job) => ({
      jobId: job.id,
      jobType: request.metadataType,
      status: request.status,
      targetStatus: request.targetStatus,
      republish: request.publishNotification ?? true,
      offset: 0,
    }));
  }

  /** @throws NotFoundException */
  async describe(jobId: string): Promise<BatchJob> {
    const fetchRequest = gql`
      query FetchBatchJob($id: uuid!) {
        dionysus_bulk_load_jobs_by_pk(id: $id) {
          ${BASE_BATCH_JOB}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetBatchJobResponse>(
        fetchRequest,
        {
          id: jobId,
        },
      );

    if (!fetchResponse.dionysus_bulk_load_jobs_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(fetchResponse.dionysus_bulk_load_jobs_by_pk);
  }

  /**
   * Applies `updates` to a batch job, stamping `finishedTime` when it moves
   * to a terminal status. @throws NotFoundException
   */
  async update(jobId: string, updates: PartialBatchJob): Promise<BatchJob> {
    const updateRequest = gql`
      mutation UpdateBatchJob(
        $id: uuid!
        $changes: dionysus_bulk_load_jobs_set_input = {}
      ) {
        update_dionysus_bulk_load_jobs_by_pk(
          pk_columns: { id: $id }
          _set: $changes
        ) {
          ${BASE_BATCH_JOB}
        }
      }
    `;

    if (
      updates.status &&
      [JobStatus.CANCELLED, JobStatus.FAILED, JobStatus.SUCCESS].includes(
        updates.status,
      ) &&
      !updates.finishedTime
    ) {
      updates.finishedTime = moment().utc();
    }

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMetadataFetchJobResponse>(
        updateRequest,
        {
          id: jobId,
          changes: updates,
        },
      );

    if (!updateResponse.update_dionysus_bulk_load_jobs_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(updateResponse.update_dionysus_bulk_load_jobs_by_pk);
  }

  /** @throws NotFoundException */
  async delete(jobId: string): Promise<void> {
    const deleteRequest = gql`
      mutation DeleteBatchJob($id: uuid!) {
        delete_dionysus_bulk_load_jobs_by_pk(id: $id) {
          id
        }
      }
    `;

    const deleteResponse =
      await this.graphQLClient.request<GraphQlDeleteBatchJobResponse>(
        deleteRequest,
        {
          id: jobId,
        },
      );

    if (!deleteResponse.delete_dionysus_bulk_load_jobs_by_pk) {
      throw new NotFoundException();
    }
  }

  /** A page of batch jobs matching `filters`. */
  async list(
    pagination: PaginationParams,
    filters?: FilterDefinition | string,
  ): Promise<BatchJobPage> {
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListBatchJobs {
      dionysus_bulk_load_jobs(${[paginationExpression, whereExpression].join(", ")}) {
        ${BASE_BATCH_JOB}
      }
      dionysus_bulk_load_jobs_aggregate${whereExpression ? `(${whereExpression})` : ""} {
        aggregate {
          count
        }
      }
    }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListBatchJobsResponse>(
        fetchRequest,
      );

    return {
      jobs: fetchResponse.dionysus_bulk_load_jobs.map((result) =>
        toDomainObject(result),
      ),
      count: fetchResponse.dionysus_bulk_load_jobs_aggregate.aggregate.count,
    };
  }

  /** A page of batch jobs of one type matching `filters`. */
  async listByType(
    type: JobType,
    pagination: PaginationParams,
    filters?: FilterDefinition | string,
  ): Promise<BatchJobPage> {
    const typeFilter: FilterDefinition = {
      type: FilterType.EQUALS,
      name: "type",
      value: type,
    };
    const userFilters = parseFilterDefinition(filters);

    const whereExpression = buildFilterExpression(
      userFilters
        ? {
            type: FilterType.AND,
            name: "_",
            value: [typeFilter, userFilters!],
          }
        : typeFilter,
    );
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListBatchJobsByType {
      dionysus_bulk_load_jobs(${[paginationExpression, whereExpression].join(", ")}) {
        ${BASE_BATCH_JOB}
      }
      dionysus_bulk_load_jobs_aggregate${whereExpression ? `(${whereExpression})` : ""} {
        aggregate {
          count
        }
      }
    }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListBatchJobsResponse>(
        fetchRequest,
      );

    return {
      jobs: fetchResponse.dionysus_bulk_load_jobs.map((result) =>
        toDomainObject(result),
      ),
      count: fetchResponse.dionysus_bulk_load_jobs_aggregate.aggregate.count,
    };
  }

  /** Status counts per metadata type and daily timings per job type. */
  async getStatistics(): Promise<GetBatchJobStatsResponse> {
    const today = startOfTodayUtc();
    const lastMonth = today.clone().subtract(30, "days");

    const fetchRequest = gql`
      query GetBatchJobStatistics($lastMonth: String!) {
        dionysus_bulk_load_jobs_statistics(
          where: { created_date: { _gt: $lastMonth } }
        ) {
          ${BATCH_JOB_STATISTICS}
        }
        dionysus_bulk_load_jobs_status_statistics {
          ${JOB_STATUS_STATISTICS}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlBatchJobStatisticsResponse>(
        fetchRequest,
        {
          lastMonth: lastMonth.toISOString(),
        },
      );

    const metadataCategories: string[] = Object.keys(METADATA_CATEGORY_MAP);

    const statusSeries: Record<JobStatus, number[]> = {
      [JobStatus.CREATED]: new Array(metadataCategories.length).fill(0, 0),
      [JobStatus.STARTED]: new Array(metadataCategories.length).fill(0, 0),
      [JobStatus.SUCCESS]: new Array(metadataCategories.length).fill(0, 0),
      [JobStatus.CANCELLED]: new Array(metadataCategories.length).fill(0, 0),
      [JobStatus.FAILED]: new Array(metadataCategories.length).fill(0, 0),
    };

    fetchResponse.dionysus_bulk_load_jobs_status_statistics.forEach((data) => {
      const seriesIndex = Object.keys(METADATA_CATEGORY_MAP).indexOf(data.type);

      if (seriesIndex > -1) {
        statusSeries[data.status][seriesIndex] = data.count as number;
      }
    });

    const queueTimeSeries = emptySeriesPerType(today);
    const runtimeSeries = emptySeriesPerType(today);

    fetchResponse.dionysus_bulk_load_jobs_statistics.forEach((data) => {
      const dataTime = moment.utc(data.created_date);
      const dateIndex = dailyIndex(today, dataTime);

      const seriesIndex = Object.keys(METADATA_CATEGORY_MAP).indexOf(data.type);

      if (seriesIndex > -1 && dateIndex !== undefined) {
        queueTimeSeries[data.type][dateIndex] = [
          dataTime.valueOf(),
          data.queue_time as number,
        ];
        runtimeSeries[data.type][dateIndex] = [
          dataTime.valueOf(),
          data.run_time as number,
        ];
      }
    });

    return {
      categories: {
        status: Object.values(METADATA_CATEGORY_MAP) as MetadataJobType[],
        timing: Object.values(BATCH_JOB_STATUSES_MAP) as JobType[],
      },
      series: {
        status: statusSeries,
        timing: {
          queueTime: queueTimeSeries,
          runtime: runtimeSeries,
        },
      },
    };
  }

  /** Daily timings and record counts for one job type. */
  async getStatisticsByType(
    type: JobType,
  ): Promise<GetBatchJobStatsByTypeResponse> {
    const fetchRequest = gql`
      query GetBatchJobStatisticsByType($type: String!) {
        dionysus_bulk_load_jobs_statistics(
          where: { type: { _eq: $type } }
          order_by: { created_date: asc }
        ) {
          ${BATCH_JOB_STATISTICS}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlBatchJobStatisticsByTypeResponse>(
        fetchRequest,
        { type: type },
      );

    const today = startOfTodayUtc();

    const recordSeries: BatchJobRecordStats = {
      total: emptyDailySeries(today),
      new: emptyDailySeries(today),
      expired: emptyDailySeries(today),
      noop: emptyDailySeries(today),
      skipped: emptyDailySeries(today),
      processed: emptyDailySeries(today),
    };

    const queueTimeSeries: number[][] = emptyDailySeries(today);
    const runtimeSeries: number[][] = emptyDailySeries(today);

    fetchResponse.dionysus_bulk_load_jobs_statistics.forEach((data) => {
      const dataTime = moment.utc(data.created_date);
      const dateIndex = dailyIndex(today, dataTime);
      if (dateIndex === undefined) return;

      const seriesIndex = Object.keys(METADATA_CATEGORY_MAP).indexOf(data.type);

      if (seriesIndex > -1 || (data.type as string) === "redrive") {
        queueTimeSeries[dateIndex] = [
          dataTime.valueOf(),
          data.queue_time as number,
        ];
        runtimeSeries[dateIndex] = [
          dataTime.valueOf(),
          data.run_time as number,
        ];
        recordSeries["total"][dateIndex] = [
          dataTime.valueOf(),
          data.total_records,
        ];
        recordSeries["new"][dateIndex] = [dataTime.valueOf(), data.new_records];
        recordSeries["expired"][dateIndex] = [
          dataTime.valueOf(),
          data.expired_records,
        ];
        recordSeries["noop"][dateIndex] = [
          dataTime.valueOf(),
          data.noop_records,
        ];
        recordSeries["skipped"][dateIndex] = [
          dataTime.valueOf(),
          data.skipped_records,
        ];
        recordSeries["processed"][dateIndex] = [
          dataTime.valueOf(),
          data.processed_records,
        ];
      }
    });

    return {
      series: {
        records: recordSeries,
        timing: {
          queueTime: queueTimeSeries,
          runtime: runtimeSeries,
        },
      },
    };
  }

  private async createJob<P>(
    type: JobType,
    shouldPublishMessage: boolean,
    route: MessageRoute<P>,
    buildMessage: (job: BatchJob) => P,
  ): Promise<BatchJob> {
    const insertRequest = gql`
      mutation CreateBatchJob($type: String) {
        insert_dionysus_bulk_load_jobs_one(object: { type: $type }) {
          ${BATCH_JOB}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateBatchJobResponse>(
        insertRequest,
        {
          type: type,
        },
      );

    const createdJob: BatchJob = toDomainObject(
      insertResponse.insert_dionysus_bulk_load_jobs_one,
    );

    if (shouldPublishMessage) {
      const message = buildMessage(createdJob);

      await publishMessage(this.amqpConnection, route, message);
    }

    return createdJob;
  }
}
