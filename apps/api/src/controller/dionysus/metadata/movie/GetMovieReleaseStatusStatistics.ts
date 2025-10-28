import {
  GetMovieReleaseStatusStatisticsResponse,
  StatusStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlMovieReleaseStatusStatistics = {
  dionysus_movie_release_status_statistics: {
    status: string;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetMovieReleaseStatusStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movies/stats/releaseStatus")
  @ApiOperation({
    summary: "Gets movie release status statistics",
    description: "Gets the release status statistics for movies.",
    operationId: "GetMovieReleaseStatusStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieReleaseStatusStatisticsResponse,
    description: "The list of status statistics.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetMovieReleaseStatusStatistics {
        dionysus_movie_release_status_statistics {
          status
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlMovieReleaseStatusStatistics>(
        fetchRequest,
      );
    const statistics: StatusStatistic[] = [];

    fetchResponse.dionysus_movie_release_status_statistics.forEach((result) => {
      statistics.push({
        status: result.status,
        count: result.count,
      });
    });

    const responseBody: GetMovieReleaseStatusStatisticsResponse = {
      statistics: statistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
