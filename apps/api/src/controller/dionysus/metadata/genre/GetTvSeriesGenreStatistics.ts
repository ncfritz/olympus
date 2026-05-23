import {
  GenreStatistic,
  GetTvSeriesGenreStatisticsResponse,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetTvSeriesGenreResponse = {
  dionysus_tv_series_genre_statistics: {
    genre: string;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetTvSeriesGenreStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/genres/stats/tvSeries")
  @ApiOperation({
    summary:
      "Gets a histogram of the number of TV series associated each genre",
    description:
      "Gets a histogram of the number of TV series associated with each genre.",
    operationId: "GetTvSeriesGenreStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesGenreStatisticsResponse,
    description: "The histogram of genre distributions.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetTvSeriesGenreStatistics {
        dionysus_tv_series_genre_statistics {
          count
          genre
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesGenreResponse>(
        fetchRequest,
      );
    const runtimeStatistics: GenreStatistic[] = [];

    fetchResponse.dionysus_tv_series_genre_statistics.forEach((result) => {
      runtimeStatistics.push({
        genre: result.genre,
        count: result.count,
      });
    });

    const responseBody: GetTvSeriesGenreStatisticsResponse = {
      statistics: runtimeStatistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
