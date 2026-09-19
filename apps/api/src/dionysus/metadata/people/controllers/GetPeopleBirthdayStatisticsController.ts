import { GetPersonLifeStaticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { PersonService } from "../services/PersonService";

@Controller({ version: "1" })
export class GetPeopleBirthdayStatisticsController {
  constructor(private readonly people: PersonService) {}

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
    const responseBody: GetPersonLifeStaticsResponse = {
      statistics: await this.people.getBirthdayStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
