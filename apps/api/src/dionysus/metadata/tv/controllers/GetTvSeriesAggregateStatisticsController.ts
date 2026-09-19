import { GetTvSeriesAggregateStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlTvSeriesAggregateStatistics = {
  dionysus_tv_series_aggregate: {
    aggregate: {
      count: number;
      sum: {
        numberOfEpisodes: number;
        numberOfSeasons: number;
      };
      max: {
        numberOfEpisodes: number;
        numberOfSeasons: number;
      };
      avg: {
        numberOfEpisodes: number;
        numberOfSeasons: number;
      };
    };
  };
};

@Controller({ version: "1" })
export class GetTvSeriesAggregateStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tv/series/stats/aggregate")
  @ApiOperation({
    summary: "Gets TV Series aggregate statistics",
    description: "Gets the aggregate statistics for TV series.",
    operationId: "GetTvSeriesAggregateStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesAggregateStatisticsResponse,
    description: "The aggregate statistics for TV series.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetTvSeriesAggregateStatistics {
        dionysus_tv_series_aggregate {
          aggregate {
            count
            sum {
              numberOfEpisodes
              numberOfSeasons
            }
            max {
              numberOfEpisodes
              numberOfSeasons
            }
            avg {
              numberOfEpisodes
              numberOfSeasons
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlTvSeriesAggregateStatistics>(
        fetchRequest,
      );

    const responseBody: GetTvSeriesAggregateStatisticsResponse = {
      count: fetchResponse.dionysus_tv_series_aggregate.aggregate.count,
      totalSeasons:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.sum
          .numberOfSeasons,
      totalEpisodes:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.sum
          .numberOfEpisodes,
      maxSeasonCount:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.max
          .numberOfSeasons,
      maxEpisodeCount:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.max
          .numberOfEpisodes,
      averageSeasonCount:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.avg
          .numberOfSeasons,
      averageEpisodeCount:
        fetchResponse.dionysus_tv_series_aggregate.aggregate.avg
          .numberOfEpisodes,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
