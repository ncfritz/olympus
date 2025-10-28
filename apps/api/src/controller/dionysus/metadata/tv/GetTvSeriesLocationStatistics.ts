import {
  GetTvSeriesLocationStatisticsResponse,
  LocationStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlTvSeriesLocationStatistics = {
  dionysus_tv_series_location_statistics: {
    countryCode: string;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetTvSeriesLocationStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tv/series/stats/locations")
  @ApiOperation({
    summary: "Gets TV series location statistics",
    description:
      "Gets the location statistics for TV series.  This API reports the counts for each country where a movie has" +
      "a production location.",
    operationId: "GetTvSeriesLocationStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesLocationStatisticsResponse,
    description: "The list of movie recommendations.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetTvSeriesLocationStatistics {
        dionysus_tv_series_location_statistics {
          countryCode
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlTvSeriesLocationStatistics>(
        fetchRequest,
      );
    const statistics: LocationStatistic[] = [];

    fetchResponse.dionysus_tv_series_location_statistics.forEach((result) => {
      statistics.push({
        countryCode: result.countryCode,
        count: result.count,
      });
    });

    const responseBody: GetTvSeriesLocationStatisticsResponse = {
      statistics: statistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
