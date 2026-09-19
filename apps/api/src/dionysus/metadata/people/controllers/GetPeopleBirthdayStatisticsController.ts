import {
  GetPersonLifeStaticsResponse,
  PersonLifeStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQGetPeopleBirthdayStatisticsResponse = {
  dionysus_people_birthday_statistics: {
    year: number;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetPeopleBirthdayStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/person/stats/birthday")
  @ApiOperation({
    summary: "Gets a histogram of birth years for people",
    description: "Gets a map of year to the number of people born that year.",
    operationId: "GetPeopleBirthdayStatistics",
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
      query GetPeopleBirthdayStatistics {
        dionysus_people_birthday_statistics(order_by: { year: asc }) {
          count
          year
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQGetPeopleBirthdayStatisticsResponse>(
        fetchRequest,
      );
    const birthyearStats: PersonLifeStatistic[] = [];

    fetchResponse.dionysus_people_birthday_statistics.forEach((result) => {
      birthyearStats.push(result);
    });

    const responseBody: GetPersonLifeStaticsResponse = {
      statistics: birthyearStats,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
