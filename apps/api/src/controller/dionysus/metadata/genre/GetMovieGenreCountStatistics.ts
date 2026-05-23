import {
  GenreCountStatistic,
  GetMovieGenreCountStatisticsResponse,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetMovieGenreCountsResponse = {
  dionysus_movie_genre_count_statistics: {
    genres: number;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetMovieGenreCountStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/genres/stats/counts/movies")
  @ApiOperation({
    summary: "Gets a histogram of the number of genres associated with movies",
    description:
      "Gets a histogram of the number of genres associated with movies.",
    operationId: "GetMovieGenreCountStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieGenreCountStatisticsResponse,
    description: "The histogram of genre counts.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetTvSeriesGenreCountStatistics {
        dionysus_movie_genre_count_statistics {
          count
          genres
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMovieGenreCountsResponse>(
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

    fetchResponse.dionysus_movie_genre_count_statistics.forEach((result) => {
      if (result.genres < countStatistics.length) {
        countStatistics[result.genres].count = result.count;
      }
    });

    const responseBody: GetMovieGenreCountStatisticsResponse = {
      statistics: countStatistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
