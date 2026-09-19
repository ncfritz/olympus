import { ListMovieRecommendationsResponse } from "@ncfritz/olympus-model";
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
export class ListMovieRecommendationsController {
  constructor(private readonly movies: MovieService) {}

  @Get("/metadata/movie/:movieId/recommendations")
  @ApiOperation({
    summary: "Lists movie recommendations",
    description:
      "Lists the recommendations for a movie.  This API is not paginated and does not support filtering.",
    operationId: "ListMovieRecommendations",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "movieId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListMovieRecommendationsResponse,
    description: "The list of movie recommendations.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("movieId", ParseIntPipe) movieId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListMovieRecommendationsResponse = {
      recommendations: await this.movies.listRecommendations(movieId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
