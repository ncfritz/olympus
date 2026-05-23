import {
  GenreStatistic,
  GetMovieGenreStatisticsResponse,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetMovieGenreResponse = {
  dionysus_movie_genre_statistics: {
    genre: string;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetMovieGenreStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/genres/stats/movies")
  @ApiOperation({
    summary: "Gets a histogram of the number of movies associated each genre",
    description:
      "Gets a histogram of the number of movies associated with each genre.",
    operationId: "GetMovieGenreStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieGenreStatisticsResponse,
    description: "The histogram of genre distributions.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetMovieGenreStatistics {
        dionysus_movie_genre_statistics {
          count
          genre
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMovieGenreResponse>(
        fetchRequest,
      );
    const runtimeStatistics: GenreStatistic[] = [];

    fetchResponse.dionysus_movie_genre_statistics.forEach((result) => {
      runtimeStatistics.push({
        genre: result.genre,
        count: result.count,
      });
    });

    const responseBody: GetMovieGenreStatisticsResponse = {
      statistics: runtimeStatistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
