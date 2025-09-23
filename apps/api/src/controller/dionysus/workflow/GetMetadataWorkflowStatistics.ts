import {
  GetMetadataWorkflowStatisticsResponse,
  WorkflowStatus,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment, { Moment } from "moment";
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
      "Retrieves stats for metadat fetch jobs broken down by job type and status.",
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

    const now = moment
      .utc()
      .set({ milliseconds: 0, seconds: 0, minutes: 0, hours: 0 });

    const statusSeries = {
      [WorkflowStatus.CREATED]: this.emptyTimingMap(moment(now)),
      [WorkflowStatus.STARTED]: this.emptyTimingMap(moment(now)),
      [WorkflowStatus.FAILED]: this.emptyTimingMap(moment(now)),
      [WorkflowStatus.SUCCESS]: this.emptyTimingMap(moment(now)),
      [WorkflowStatus.CANCELLED]: this.emptyTimingMap(moment(now)),
    };
    const queueTimeSeries: number[][] = this.emptyTimingMap(moment(now));
    const runtimeSeries: number[][] = this.emptyTimingMap(moment(now));

    fetchResponse.dionysus_metadata_workflow_statistics.forEach((data) => {
      const dataTime = moment.utc(data.createdTime);
      const dateIndex = 30 - now.diff(dataTime, "days");

      queueTimeSeries[dateIndex] = [
        dataTime.valueOf(),
        data.queueTime as number,
      ];
      runtimeSeries[dateIndex] = [dataTime.valueOf(), data.runTime as number];
    });

    fetchResponse.dionysus_metadata_workflow_status_statistics.forEach(
      (data) => {
        const dataTime = moment.utc(data.createdTime);
        const dateIndex = 30 - now.diff(dataTime, "days");

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

  emptyTimingMap(now: Moment): number[][] {
    const valuesTemplate = [];

    for (let i = 30; i > 0; i--) {
      const ts = moment(now).subtract({ days: i }).valueOf();
      valuesTemplate.push([ts, 0]);
    }

    return [...valuesTemplate];
  }
}
