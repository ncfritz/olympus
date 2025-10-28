import {
  GetTvSeriesEpisodeStatisticsResponse,
  RuntimeStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import prettyMilliseconds from "pretty-ms";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetTvSeriesEpisodeRuntimesResponse = {
  dionysus_tv_series_episode_runtime_statistics: {
    rt: number;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetTvSeriesEpisodeRuntimeStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tv/series/stats/runtime")
  @ApiOperation({
    summary: "Gets a histogram of runtimes for TV series episodes",
    description:
      "Gets a histogram of TV series episode runtimes.  This excludes any runtimes greater than 6H.",
    operationId: "GetTvSeriesEpisodeRuntimeStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesEpisodeStatisticsResponse,
    description: "The histogram of movie runtimes.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetTvSeriesEpisodeRuntimeStatistics {
        dionysus_tv_series_episode_runtime_statistics {
          rt
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesEpisodeRuntimesResponse>(
        fetchRequest,
      );
    const runtimeStatistics: RuntimeStatistic[] = [];

    fetchResponse.dionysus_tv_series_episode_runtime_statistics.forEach(
      (result) => {
        runtimeStatistics.push({
          runtime: result.rt,
          label: prettyMilliseconds(result.rt * 60 * 1000, { unitCount: 2 }),
          count: result.count,
        });
      },
    );

    const responseBody: GetTvSeriesEpisodeStatisticsResponse = {
      statistics: runtimeStatistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
