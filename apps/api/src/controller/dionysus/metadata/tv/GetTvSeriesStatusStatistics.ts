import {
  GetTvSeriesStatusStatisticsResponse,
  StatusStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlTvSeriesStatusStatistics = {
  dionysus_tv_series_status_statistics: {
    status: string;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetTvSeriesStatusStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tv/series/stats/releaseStatus")
  @ApiOperation({
    summary: "Gets TV series release status statistics",
    description: "Gets the release status statistics for Tv series.",
    operationId: "GetTvSeriesStatusStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesStatusStatisticsResponse,
    description: "The list of status statistics.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GraphQlTvSeriesStatusStatistics {
        dionysus_tv_series_status_statistics {
          status
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlTvSeriesStatusStatistics>(
        fetchRequest,
      );
    const statistics: StatusStatistic[] = [];

    fetchResponse.dionysus_tv_series_status_statistics.forEach((result) => {
      statistics.push({
        status: result.status,
        count: result.count,
      });
    });

    const responseBody: GetTvSeriesStatusStatisticsResponse = {
      statistics: statistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
