import {
  GetPersonDepartmentStaticsResponse,
  PersonDepartmentStatistic,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQGetPeopleDepartmentStatisticsResponse = {
  dionysus_people_known_for: {
    department: string;
    count: number;
  }[];
};

@Controller({ version: "1" })
export class GetPeopleDepartmentStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/person/stats/department")
  @ApiOperation({
    summary: "Gets people counts by department",
    description: "Gets the number of people known for each department.",
    operationId: "GetPeopleDepartmentStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetPersonDepartmentStaticsResponse,
    description:
      "The list of birth years to the cunt of people born that year.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetPeopleDepartmentStatistics {
        dionysus_people_known_for(order_by: { department: asc }) {
          count
          department
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQGetPeopleDepartmentStatisticsResponse>(
        fetchRequest,
      );
    const departmentStats: PersonDepartmentStatistic[] = [];
    let unknownCount = 0;
    let actingCount = 0;

    fetchResponse.dionysus_people_known_for.forEach((result) => {
      const key = result.department;

      if (key === null || result.department === "") {
        unknownCount += result.count;
        return;
      }

      if (key === "Acting" || result.department === "Actors") {
        actingCount += result.count;
        return;
      }

      departmentStats.push({
        department: key,
        count: result.count,
      });
    });

    departmentStats.push({
      department: "Unknown",
      count: unknownCount,
    });

    departmentStats.unshift({
      department: "Acting",
      count: actingCount,
    });

    const responseBody: GetPersonDepartmentStaticsResponse = {
      statistics: departmentStats,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
