import {
  GetMovieRuntimeStatisticsResponse,
  RuntimeStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import prettyMilliseconds from "pretty-ms";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQGetMovieRuntimeStatisticsResponse = {
  dionysus_movie_runtime_statistics: {
    rt: number;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetMovieRuntimeStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movies/stats/runtime")
  @ApiOperation({
    summary: "Gets a histogram of runtimes for movies",
    description:
      "Gets a histogram of movie runtimes.  This excludes any runtimes greater than 6H.",
    operationId: "GetMovieRuntimeStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieRuntimeStatisticsResponse,
    description: "The histogram of movie runtimes.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetMovieRuntimeStatistics {
        dionysus_movie_runtime_statistics {
          rt
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQGetMovieRuntimeStatisticsResponse>(
        fetchRequest,
      );
    const runtimeStatistics: RuntimeStatistic[] = [];

    fetchResponse.dionysus_movie_runtime_statistics.forEach((result) => {
      runtimeStatistics.push({
        runtime: result.rt,
        label: prettyMilliseconds(result.rt * 60 * 1000, { unitCount: 2 }),
        count: result.count,
      });
    });

    const responseBody: GetMovieRuntimeStatisticsResponse = {
      statistics: runtimeStatistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
