import {
  BatchJobRecordStats,
  GetBatchJobStatsByTypeResponse,
  JobType,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment, { Moment } from "moment/moment";
import { GraphQlBulkLoadJobStat } from "../../../../types/batchJobs";
import { METADATA_CATEGORY_MAP } from "../../../../utils/constants";

import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

export type GraphQlBatchJobStatisticsResponse = {
  dionysus_bulk_load_jobs_statistics: GraphQlBulkLoadJobStat[];
};

@Controller({ version: "1" })
export class GetBatchJobStatsByTypeController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/jobs/batch/:jobType/stats")
  @ApiOperation({
    summary: "Gets stats for a specific batch job type",
    description:
      "Gets the last 90 days work of execution and performance stats for a batch job type.",
    operationId: "GetBatchJobStatsByType",
    tags: ["Batch"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "jobType",
    description: "The type of batch job to get statistics for.",
    enum: JobType,
    enumName: "JobType",
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: GetBatchJobStatsByTypeResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("jobType") type: JobType,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query GetBatchJobStatistics($type: String!) {
        dionysus_bulk_load_jobs_statistics(
          where: { type: { _eq: $type } }
          order_by: { created_date: asc }
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
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlBatchJobStatisticsResponse>(
        fetchRequest,
        { type: type },
      );

    const now = moment
      .utc()
      .set({ milliseconds: 0, seconds: 0, minutes: 0, hours: 0 });

    const recordSeries: BatchJobRecordStats = {
      total: this.emptyTimingMap(moment(now)),
      new: this.emptyTimingMap(moment(now)),
      expired: this.emptyTimingMap(moment(now)),
      noop: this.emptyTimingMap(moment(now)),
      skipped: this.emptyTimingMap(moment(now)),
      processed: this.emptyTimingMap(moment(now)),
    };

    const queueTimeSeries: number[][] = this.emptyTimingMap(moment(now));
    const runtimeSeries: number[][] = this.emptyTimingMap(moment(now));

    fetchResponse.dionysus_bulk_load_jobs_statistics.forEach((data) => {
      const dataTime = moment.utc(data.created_date);
      const dateIndex = 30 - now.diff(dataTime, "days");

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

    const responseBody: GetBatchJobStatsByTypeResponse = {
      series: {
        records: recordSeries,
        timing: {
          queueTime: queueTimeSeries,
          runtime: runtimeSeries,
        },
      },
    };

    response.status(HttpStatus.OK).json(responseBody);
  }

  emptyTimingMap(now: Moment): number[][] {
    const valuesTemplate = [];

    for (let i = 30; i > 0; i--) {
      const ts = moment(now).subtract({ days: i }).valueOf();
      valuesTemplate.push([ts, 0]);
    }

    return [...valuesTemplate];
  }
}
