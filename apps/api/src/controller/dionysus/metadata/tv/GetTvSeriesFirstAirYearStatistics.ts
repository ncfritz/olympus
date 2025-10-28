import {
  GetTvSeriesFirstAirYearStatisticsResponse,
  YearStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetTvSeriesFirstAirYearStatisticsResponse = {
  dionysus_tv_series_first_air_date_statistics: {
    year: number;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetTvSeriesFirstAirYearStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tv/series/stats/firstAirYear")
  @ApiOperation({
    summary: "Gets a histogram of first air years for TV series",
    description:
      "Gets a map of year to the number of TV series that first aired that year.",
    operationId: "GetTvSeriesFirstAirYearStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesFirstAirYearStatisticsResponse,
    description:
      "The list off years to the count of movies released that year.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetTvSeriesFirstAirYearStatistics {
        dionysus_tv_series_first_air_date_statistics(order_by: { year: asc }) {
          count
          year
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesFirstAirYearStatisticsResponse>(
        fetchRequest,
      );
    const releaseYearStatistics: YearStatistic[] = [];

    fetchResponse.dionysus_tv_series_first_air_date_statistics.forEach(
      (result) => {
        releaseYearStatistics.push(result);
      },
    );

    const responseBody: GetTvSeriesFirstAirYearStatisticsResponse = {
      statistics: releaseYearStatistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
