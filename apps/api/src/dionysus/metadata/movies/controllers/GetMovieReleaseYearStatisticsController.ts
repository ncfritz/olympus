import { GetMovieReleaseYearStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MovieService } from "../services/MovieService";

@Controller({ version: "1" })
export class GetMovieReleaseYearStatisticsController {
  constructor(private readonly movies: MovieService) {}

  @Get("/metadata/movies/stats/releaseYear")
  @ApiOperation({
    summary: "Gets a histogram of release years for movies",
    description:
      "Gets a map of year to the number of movies releases that year.",
    operationId: "GetMovieReleaseYearStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieReleaseYearStatisticsResponse,
    description:
      "The list off years to the count of movies released that year.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetMovieReleaseYearStatisticsResponse = {
      statistics: await this.movies.getReleaseYearStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
