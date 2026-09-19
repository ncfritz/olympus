import {
  GenreCountStatistic,
  GetTvSeriesGenreCountStatisticsResponse,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetTvSeriesGenreCountsResponse = {
  dionysus_tv_series_genre_count_statistics: {
    genres: number;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetTvSeriesGenreCountStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/genres/stats/counts/tvSeries")
  @ApiOperation({
    summary:
      "Gets a histogram of the number of genres associated with TV series",
    description:
      "Gets a histogram of the number of genres associated with TV series.",
    operationId: "GetTvSeriesGenreCountStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesGenreCountStatisticsResponse,
    description: "The histogram of genre counts.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetTvSeriesGenreCountStatistics {
        dionysus_tv_series_genre_count_statistics {
          count
          genres
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesGenreCountsResponse>(
        fetchRequest,
      );
    const countStatistics: GenreCountStatistic[] = Array.from(
      { length: 19 },
      (v, i) => {
        return {
          genres: i + 1,
          count: 0,
        };
      },
    );

    fetchResponse.dionysus_tv_series_genre_count_statistics.forEach(
      (result) => {
        // Entry i holds the count of titles with i + 1 genres.
        const index = result.genres - 1;
        if (index >= 0 && index < countStatistics.length) {
          countStatistics[index].count = result.count;
        }
      },
    );

    const responseBody: GetTvSeriesGenreCountStatisticsResponse = {
      statistics: countStatistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
