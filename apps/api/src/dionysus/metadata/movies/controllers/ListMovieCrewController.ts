import { ListMovieCrewResponse } from "@ncfritz/olympus-model";
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
import { MovieService } from "../services/MovieService";

@Controller({ version: "1" })
export class ListMovieCrewController {
  constructor(private readonly movies: MovieService) {}

  @Get("/metadata/movie/:movieId/crew")
  @ApiOperation({
    summary: "Lists movie crew members",
    description:
      "Lists the full crew for a movie.  This API is not paginated and does not support filtering.",
    operationId: "ListMovieCrew",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "movieId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListMovieCrewResponse,
    description: "The list of movie crew members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("movieId", ParseIntPipe) movieId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListMovieCrewResponse = {
      crew: await this.movies.listCrew(movieId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
