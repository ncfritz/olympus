import { GetPersonDepartmentStaticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { PersonService } from "../services/PersonService";

@Controller({ version: "1" })
export class GetPeopleDepartmentStatisticsController {
  constructor(private readonly people: PersonService) {}

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
    const responseBody: GetPersonDepartmentStaticsResponse = {
      statistics: await this.people.getDepartmentStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
