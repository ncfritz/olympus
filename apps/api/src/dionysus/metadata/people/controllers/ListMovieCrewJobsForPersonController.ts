import { ListMovieCrewJobsForPersonResponse } from "@ncfritz/olympus-model";
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
export class ListMovieCrewJobsForPersonController {
  constructor(private readonly people: PersonService) {}

  @Get("/metadata/person/:personId/movie/crew")
  @ApiOperation({
    summary: "Lists a person's movie crew credits",
    description: "Lists the movies a person has crew credits for.",
    operationId: "ListMovieCrewJobsForPerson",
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
    type: ListMovieCrewJobsForPersonResponse,
    description:
      "The list of production companies.  If there are more companies to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("personId", ParseIntPipe) personId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListMovieCrewJobsForPersonResponse = {
      credits: await this.people.listMovieCrewJobs(personId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
