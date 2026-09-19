import { GetPersonLifeStaticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { PersonService } from "../services/PersonService";

@Controller({ version: "1" })
export class GetPeopleDeathdayStatisticsController {
  constructor(private readonly people: PersonService) {}

  @Get("/metadata/person/stats/deathday")
  @ApiOperation({
    summary: "Gets a histogram of death years for people",
    description:
      "Gets a map of year to the number of people who died that year.",
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
    const responseBody: GetPersonLifeStaticsResponse = {
      statistics: await this.people.getDeathdayStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
