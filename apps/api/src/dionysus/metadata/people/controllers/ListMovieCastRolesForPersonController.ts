import { ListMovieCastRolesForPersonResponse } from "@ncfritz/olympus-model";
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
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { PersonService } from "../services/PersonService";

@Controller({ version: "1" })
export class ListMovieCastRolesForPersonController {
  constructor(private readonly people: PersonService) {}

  @Get("/metadata/person/:personId/movie/cast")
  @ApiOperation({
    summary: "Lists a person's movie cast credits",
    description: "Lists the movies a person has cast credits for.",
    operationId: "ListMovieCastRolesForPerson",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "personId",
    type: Number,
    required: true,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListMovieCastRolesForPersonResponse,
    description:
      "The list of production companies.  If there are more companies to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("personId", ParseIntPipe) personId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListMovieCastRolesForPersonResponse = {
      credits: await this.people.listMovieCastRoles(personId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
