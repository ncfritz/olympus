import { DescribePersonResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { PersonService } from "../services/PersonService";

@Controller({ version: "1" })
export class DescribePersonController {
  constructor(private readonly people: PersonService) {}

  @Get("/metadata/person/:personId")
  @ApiOperation({
    summary: "Describes a person in Dionysus",
    description: "Retrieves the details of a person in Dionysus.",
    operationId: "DescribePerson",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "personId",
    description: "The ID of the person to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribePersonResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("personId", ParseIntPipe) personId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribePersonResponse = {
      person: await this.people.describe(personId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
