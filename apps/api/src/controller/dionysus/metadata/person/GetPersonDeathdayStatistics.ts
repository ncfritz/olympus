import {
  GetPersonLifeStaticsResponse,
  PersonLifeStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQGetPeopleDeathdayStatisticsResponse = {
  dionysus_people_deathday_statistics: {
    year: number;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetPeopleDeathdayStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/person/stats/deathday")
  @ApiOperation({
    summary: "Gets a histogram of birthyears for people",
    description: "Gets a map of year to the number of people born that year.",
    operationId: "GetPeopleDeathdayStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetPersonLifeStaticsResponse,
    description:
      "The list of birth years to the cunt of people born that year.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetPeopleDeathdayStatistics {
        dionysus_people_deathday_statistics(order_by: { year: asc }) {
          count
          year
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQGetPeopleDeathdayStatisticsResponse>(
        fetchRequest,
      );
    const birthyearStats: PersonLifeStatistic[] = [];

    fetchResponse.dionysus_people_deathday_statistics.forEach((result) => {
      birthyearStats.push(result);
    });

    const responseBody: GetPersonLifeStaticsResponse = {
      statistics: birthyearStats,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
