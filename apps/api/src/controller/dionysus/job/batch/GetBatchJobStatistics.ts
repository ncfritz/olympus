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

import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlBatchJobStatisticsResponse = {
  dionysus_bulk_load_jobs_statistics: GraphQlBulkLoadJobStat[];
  dionysus_bulk_load_jobs_status_statistics: GraphQlBulkLoadJobStatusStat[];
};

@Controller({ version: "1" })
export class GetBatchJobStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/jobs/batch/stats")
  @ApiOperation({
    summary: "Gets stats for Dionysus batch jobs.",
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
    const currentTime = moment.utc().set({
      hours: 0,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    });
    const lastMonth = currentTime.subtract(30, "days");

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

    const statusCategories: string[] = Object.keys(BATCH_JOB_STATUSES_MAP);
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

    const now = moment
      .utc()
      .set({ milliseconds: 0, seconds: 0, minutes: 0, hours: 0 });

    const queueTimeSeries: Record<MetadataJobType, number[][]> =
      this.emptyTimingMap(statusCategories.length, moment(now));
    const runtimeSeries: Record<MetadataJobType, number[][]> =
      this.emptyTimingMap(statusCategories.length, moment(now));

    fetchResponse.dionysus_bulk_load_jobs_statistics.forEach((data) => {
      const dataTime = moment.utc(data.created_date);
      const dateIndex = 30 - now.diff(dataTime, "days");

      const seriesIndex = Object.keys(METADATA_CATEGORY_MAP).indexOf(data.type);

      if (seriesIndex > -1) {
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

  emptyTimingMap(
    length: number,
    now: Moment,
  ): Record<MetadataJobType, number[][]> {
    const valuesTemplate = [];

    for (let i = 30; i > 0; i--) {
      const ts = moment(now).subtract({ days: i }).valueOf();
      valuesTemplate.push([ts, 0]);
    }

    return {
      [MetadataJobType.CERTIFICATIONS]: [...valuesTemplate],
      [MetadataJobType.COLLECTIONS]: [...valuesTemplate],
      [MetadataJobType.COUNTRIES]: [...valuesTemplate],
      [MetadataJobType.GENRES]: [...valuesTemplate],
      [MetadataJobType.KEYWORDS]: [...valuesTemplate],
      [MetadataJobType.LANGUAGES]: [...valuesTemplate],
      [MetadataJobType.MOVIES]: [...valuesTemplate],
      [MetadataJobType.PEOPLE]: [...valuesTemplate],
      [MetadataJobType.PRODUCTION_COMPANIES]: [...valuesTemplate],
      [MetadataJobType.TV_EPISODES]: [...valuesTemplate],
      [MetadataJobType.TV_NETWORKS]: [...valuesTemplate],
      [MetadataJobType.TV_SEASONS]: [...valuesTemplate],
      [MetadataJobType.TV_SERIES]: [...valuesTemplate],
    };
  }
}
