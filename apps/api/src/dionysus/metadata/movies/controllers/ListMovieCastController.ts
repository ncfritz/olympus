import { ListMovieCastResponse } from "@ncfritz/olympus-model";
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
export class ListMovieCastController {
  constructor(private readonly movies: MovieService) {}

  @Get("/metadata/movie/:movieId/cast")
  @ApiOperation({
    summary: "Lists movie cast members",
    description:
      "Lists the full cast for a movie.  This API is not paginated and does not support filtering.",
    operationId: "ListMovieCast",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "movieId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListMovieCastResponse,
    description: "The list of movie cast members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("movieId", ParseIntPipe) movieId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListMovieCastResponse = {
      cast: await this.movies.listCast(movieId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
