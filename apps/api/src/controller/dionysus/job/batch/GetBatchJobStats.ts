import {
  GetBatchJobStatsResponse,
  JobStatus,
  JobType,
  MetadataJobType,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment, { Moment } from "moment";
import {
  GraphQlBulkLoadJobStat,
  GraphQlBulkLoadJobStatusStat,
} from "../../../../types/batchJobs";
import {
  BATCH_JOB_STATUSES_MAP,
  METADATA_CATEGORY_MAP,
} from "../../../../utils/constants";

import {
  dailyIndex,
  emptyDailySeries,
  startOfTodayUtc,
} from "../../../../utils/dailySeries";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlBatchJobStatisticsResponse = {
  dionysus_bulk_load_jobs_statistics: GraphQlBulkLoadJobStat[];
  dionysus_bulk_load_jobs_status_statistics: GraphQlBulkLoadJobStatusStat[];
};

@Controller({ version: "1" })
export class GetBatchJobStatsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/jobs/batch/stats")
  @ApiOperation({
    summary: "Gets stats for Dionysus batch jobs",
    description:
      "Gets the last 90 days worth of Dionysus batch job executions.  This API only returns the " +
      "execution status of the jobs.  For actual execution statistics, callers should use the " +
      "GetBatchJobStatsByType API.",
    operationId: "GetBatchJobStats",
    tags: ["Batch"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "Request completed successfully.",
    type: GetBatchJobStatsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const today = startOfTodayUtc();
    const lastMonth = today.clone().subtract(30, "days");

    const fetchRequest = gql`
      query GetBatchJobStatistics($lastMonth: String!) {
        dionysus_bulk_load_jobs_statistics(
          where: { created_date: { _gt: $lastMonth } }
        ) {
          count
          created_date
          duplicate_records
          expired_records
          new_records
          noop_records
          processed_records
          queue_time
          run_time
          skipped_records
          total_records
          type
        }
        dionysus_bulk_load_jobs_status_statistics {
          count
          status
          type
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

    const queueTimeSeries = this.emptySeriesPerType(today);
    const runtimeSeries = this.emptySeriesPerType(today);

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

    const responseBody: GetBatchJobStatsResponse = {
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

    response.status(HttpStatus.OK).send(responseBody);
  }

  private emptySeriesPerType(
    today: Moment,
  ): Record<MetadataJobType, number[][]> {
    return Object.fromEntries(
      Object.values(MetadataJobType).map((type) => [
        type,
        emptyDailySeries(today),
      ]),
    ) as Record<MetadataJobType, number[][]>;
  }
}
