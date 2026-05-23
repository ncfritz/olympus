import {
  GetMovieLocationStatisticsResponse,
  LocationStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlMovieLocationStatistics = {
  dionysus_movie_location_statistics: {
    countryCode: string;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetMovieLocationStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movies/stats/locations")
  @ApiOperation({
    summary: "Gets movie location statistics",
    description:
      "Gets the location statistics for movies.  This API reports the counts for each country where a movie has" +
      "a production location.",
    operationId: "GetMovieLocationStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieLocationStatisticsResponse,
    description: "The list of movie recommendations.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetMovieLocationStatistics {
        dionysus_movie_location_statistics {
          countryCode
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlMovieLocationStatistics>(
        fetchRequest,
      );
    const statistics: LocationStatistic[] = [];

    fetchResponse.dionysus_movie_location_statistics.forEach((result) => {
      statistics.push({
        countryCode: result.countryCode,
        count: result.count,
      });
    });

    const responseBody: GetMovieLocationStatisticsResponse = {
      statistics: statistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
