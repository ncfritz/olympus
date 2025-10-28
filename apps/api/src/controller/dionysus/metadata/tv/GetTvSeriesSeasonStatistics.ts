import {
  GetTvSeriesSeasonStatisticsResponse,
  SeasonStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetTvSeriesSeasonStatisticsResponse = {
  dionysus_tv_series_season_statistics: {
    count: number;
    seasons: number;
  }[];
};

@Controller({ version: "1" })
export class GetTvSeriesSeasonStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tv/series/stats/seasons")
  @ApiOperation({
    summary: "Gets a histogram of season counts for TV series",
    description: "Gets a map of year to the number of seasons for TV series.",
    operationId: "GetTvSeriesSeasonStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesSeasonStatisticsResponse,
    description:
      "The list off years to the count of movies released that year.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetTvSeriesSeasonStatistics {
        dionysus_tv_series_season_statistics {
          count
          seasons
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesSeasonStatisticsResponse>(
        fetchRequest,
      );
    const seasonStatistics: SeasonStatistic[] = [];

    fetchResponse.dionysus_tv_series_season_statistics.forEach((result) => {
      seasonStatistics.push(result);
    });

    const responseBody: GetTvSeriesSeasonStatisticsResponse = {
      statistics: seasonStatistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
