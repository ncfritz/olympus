import {
  ContentIngestionWorkflowAssetLocation,
  ContentIngestionWorkflowStatus,
  GetContentIngestionWorkflowStatisticsResponse,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment, { Moment } from "moment";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetContentIngestionWorkflowStats = {
  dionysus_content_asset_ingest_workflow_status_statistics: [
    {
      count: number;
      createdTime: string;
      status: ContentIngestionWorkflowStatus;
    },
  ];
  dionysus_content_asset_ingest_workflow_status_aggregate: [
    {
      count: number;
      status: ContentIngestionWorkflowStatus;
    },
  ];
  dionysus_content_asset_ingest_workflow_source_aggregate: [
    {
      count: number;
      sourceType: ContentIngestionWorkflowAssetLocation;
    },
  ];
};

@Controller({ version: "1" })
export class GetContentIngestionWorkflowStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/content/workflow/stats")
  @ApiOperation({
    summary: "Get workflow status counts and source statistics",
    description:
      "Retrieves stats for content ingestion workflows including aggregate " +
      "status and source statistics and daily status breakdowns for the past " +
      "30 days.",
    operationId: "GetContentIngestionWorkflowStatistics",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The statistics were successfully fetched.",
    type: () => GetContentIngestionWorkflowStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetContentIngestionWorkflowStatistics {
        dionysus_content_asset_ingest_workflow_status_statistics {
          count
          status
          createdTime
        }
        dionysus_content_asset_ingest_workflow_status_aggregate {
          count
          status
        }
        dionysus_content_asset_ingest_workflow_source_aggregate {
          count
          sourceType
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetContentIngestionWorkflowStats>(
        fetchRequest,
      );

    const now = moment
      .utc()
      .set({ milliseconds: 0, seconds: 0, minutes: 0, hours: 0 });

    const statusSeries = {
      [ContentIngestionWorkflowStatus.QUEUED]: this.emptyTimingMap(moment(now)),
      [ContentIngestionWorkflowStatus.RUNNING]: this.emptyTimingMap(
        moment(now),
      ),
      [ContentIngestionWorkflowStatus.SUCCESS]: this.emptyTimingMap(
        moment(now),
      ),
      [ContentIngestionWorkflowStatus.FAILED]: this.emptyTimingMap(moment(now)),
      [ContentIngestionWorkflowStatus.SKIPPED]: this.emptyTimingMap(
        moment(now),
      ),
      [ContentIngestionWorkflowStatus.DUPLICATE]: this.emptyTimingMap(
        moment(now),
      ),
    };
    const statusAggregateSeries: Record<
      ContentIngestionWorkflowStatus,
      number
    > = {
      [ContentIngestionWorkflowStatus.QUEUED]: 0,
      [ContentIngestionWorkflowStatus.RUNNING]: 0,
      [ContentIngestionWorkflowStatus.SUCCESS]: 0,
      [ContentIngestionWorkflowStatus.FAILED]: 0,
      [ContentIngestionWorkflowStatus.SKIPPED]: 0,
      [ContentIngestionWorkflowStatus.DUPLICATE]: 0,
    };
    const sourceAggregateSeries: Record<
      ContentIngestionWorkflowAssetLocation,
      number
    > = {
      [ContentIngestionWorkflowAssetLocation.REMOTE]: 0,
      [ContentIngestionWorkflowAssetLocation.LOCAL]: 0,
    };

    fetchResponse.dionysus_content_asset_ingest_workflow_status_statistics.forEach(
      (data) => {
        const dataTime = moment.utc(data.createdTime);
        const dateIndex = 30 - now.diff(dataTime, "days");

        statusSeries[data.status][dateIndex] = [dataTime.valueOf(), data.count];
      },
    );

    fetchResponse.dionysus_content_asset_ingest_workflow_status_aggregate.forEach(
      (data) => {
        statusAggregateSeries[data.status] = data.count;
      },
    );

    fetchResponse.dionysus_content_asset_ingest_workflow_source_aggregate.forEach(
      (data) => {
        sourceAggregateSeries[data.sourceType] = data.count;
      },
    );

    const modeledResponse: GetContentIngestionWorkflowStatisticsResponse = {
      categories: {
        status: [
          ContentIngestionWorkflowStatus.QUEUED,
          ContentIngestionWorkflowStatus.RUNNING,
          ContentIngestionWorkflowStatus.SUCCESS,
          ContentIngestionWorkflowStatus.FAILED,
          ContentIngestionWorkflowStatus.SKIPPED,
          ContentIngestionWorkflowStatus.DUPLICATE,
        ],
        source: [
          ContentIngestionWorkflowAssetLocation.REMOTE,
          ContentIngestionWorkflowAssetLocation.LOCAL,
        ],
      },
      series: {
        status: statusSeries,
        statusAggregate: statusAggregateSeries,
        sourceAggregate: sourceAggregateSeries,
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
