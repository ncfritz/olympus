import {
  GetMetadataWorkflowStatisticsResponse,
  WorkflowStatus,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  dailyIndex,
  emptyDailySeries,
  startOfTodayUtc,
} from "../../../utils/dailySeries";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGetMetadataWorkflowStats = {
  dionysus_metadata_workflow_status_statistics: [
    { count: number; createdTime: string; status: WorkflowStatus },
  ];
  dionysus_metadata_workflow_statistics: [
    { count: number; createdTime: string; queueTime: number; runTime: number },
  ];
};

@Controller({ version: "1" })
export class GetMetadataWorkflowStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/workflow/stats")
  @ApiOperation({
    summary: "Get workflow status counts and timing statistics",
    description:
      "Retrieves status counts and timing statistics for metadata workflows.",
    operationId: "GetMetadataWorkflowStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The statistics were successfully fetched.",
    type: () => GetMetadataWorkflowStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetMetadataWorkflowStatistics {
        dionysus_metadata_workflow_status_statistics {
          count
          createdTime
          status
        }
        dionysus_metadata_workflow_statistics {
          count
          createdTime
          queueTime
          runTime
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMetadataWorkflowStats>(
        fetchRequest,
      );

    const today = startOfTodayUtc();

    const statusSeries = {
      [WorkflowStatus.CREATED]: emptyDailySeries(today),
      [WorkflowStatus.STARTED]: emptyDailySeries(today),
      [WorkflowStatus.FAILED]: emptyDailySeries(today),
      [WorkflowStatus.SUCCESS]: emptyDailySeries(today),
      [WorkflowStatus.CANCELLED]: emptyDailySeries(today),
    };
    const queueTimeSeries: number[][] = emptyDailySeries(today);
    const runtimeSeries: number[][] = emptyDailySeries(today);

    fetchResponse.dionysus_metadata_workflow_statistics.forEach((data) => {
      const dataTime = moment.utc(data.createdTime);
      const dateIndex = dailyIndex(today, dataTime);
      if (dateIndex === undefined) return;

      queueTimeSeries[dateIndex] = [
        dataTime.valueOf(),
        data.queueTime as number,
      ];
      runtimeSeries[dateIndex] = [dataTime.valueOf(), data.runTime as number];
    });

    fetchResponse.dionysus_metadata_workflow_status_statistics.forEach(
      (data) => {
        const dataTime = moment.utc(data.createdTime);
        const dateIndex = dailyIndex(today, dataTime);
        if (dateIndex === undefined || !(data.status in statusSeries)) return;

        statusSeries[data.status][dateIndex] = [dataTime.valueOf(), data.count];
      },
    );

    const modeledResponse: GetMetadataWorkflowStatisticsResponse = {
      categories: {
        status: [
          WorkflowStatus.CREATED,
          WorkflowStatus.STARTED,
          WorkflowStatus.SUCCESS,
          WorkflowStatus.FAILED,
          WorkflowStatus.CANCELLED,
        ],
      },
      series: {
        status: statusSeries,
        timing: {
          queueTime: queueTimeSeries,
          runtime: runtimeSeries,
        },
      },
    };

    response.status(HttpStatus.OK).send(modeledResponse);
  }
}
