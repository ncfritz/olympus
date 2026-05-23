import { GetMovieAggregateStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlMovieAggregateStatistics = {
  dionysus_movies_aggregate: {
    aggregate: {
      count: number;
      avg: {
        budget: number;
        revenue: number;
        runtime: number;
      };
      max: {
        revenue: number;
      };
    };
  };
};

@Controller({ version: "1" })
export class GetMovieAggregateStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movies/stats/aggregate")
  @ApiOperation({
    summary: "Gets movie aggregate statistics",
    description: "Gets the aggregate statistics for movies.",
    operationId: "GetMovieAggregateStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieAggregateStatisticsResponse,
    description: "The aggregate statistics for movies.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetMovieAggregateStatistics {
        dionysus_movies_aggregate {
          aggregate {
            count
            avg {
              budget
              revenue
              runtime
            }
            max {
              revenue
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlMovieAggregateStatistics>(
        fetchRequest,
      );

    const responseBody: GetMovieAggregateStatisticsResponse = {
      averageBudget:
        fetchResponse.dionysus_movies_aggregate.aggregate.avg.budget,
      averageRevenue:
        fetchResponse.dionysus_movies_aggregate.aggregate.avg.revenue,
      averageRuntime:
        fetchResponse.dionysus_movies_aggregate.aggregate.avg.runtime,
      count: fetchResponse.dionysus_movies_aggregate.aggregate.count,
      maxRevenue: fetchResponse.dionysus_movies_aggregate.aggregate.max.revenue,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
