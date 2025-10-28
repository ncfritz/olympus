import {
  GetMovieReleaseYearStatisticsResponse,
  YearStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetMovieReleaseYearStatisticsResponse = {
  dionysus_movie_release_date_statistics: {
    year: number;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetMovieReleaseYearStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movies/stats/releaseYear")
  @ApiOperation({
    summary: "Gets a histogram of release years for movies",
    description:
      "Gets a map of year to the number of movies releases that year.",
    operationId: "GetMovieReleaseYearStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieReleaseYearStatisticsResponse,
    description:
      "The list off years to the count of movies released that year.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetMovieReleaseYearStatistics {
        dionysus_movie_release_date_statistics(order_by: { year: asc }) {
          count
          year
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMovieReleaseYearStatisticsResponse>(
        fetchRequest,
      );
    const releaseYearStatistics: YearStatistic[] = [];

    fetchResponse.dionysus_movie_release_date_statistics.forEach((result) => {
      releaseYearStatistics.push(result);
    });

    const responseBody: GetMovieReleaseYearStatisticsResponse = {
      statistics: releaseYearStatistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
