import {
  ContentIngestionWorkflowAssetLocation,
  ContentIngestionWorkflowStatus,
  GetContentIngestionWorkflowStatisticsResponse,
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
} from "../../../../utils/dailySeries";
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

    const today = startOfTodayUtc();

    const statusSeries = {
      [ContentIngestionWorkflowStatus.QUEUED]: emptyDailySeries(today),
      [ContentIngestionWorkflowStatus.RUNNING]: emptyDailySeries(today),
      [ContentIngestionWorkflowStatus.SUCCESS]: emptyDailySeries(today),
      [ContentIngestionWorkflowStatus.FAILED]: emptyDailySeries(today),
      [ContentIngestionWorkflowStatus.SKIPPED]: emptyDailySeries(today),
      [ContentIngestionWorkflowStatus.DUPLICATE]: emptyDailySeries(today),
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
        const dateIndex = dailyIndex(today, dataTime);
        if (dateIndex === undefined || !(data.status in statusSeries)) return;

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
}
