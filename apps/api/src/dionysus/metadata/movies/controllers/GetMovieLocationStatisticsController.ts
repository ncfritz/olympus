import { GetMovieLocationStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MovieService } from "../services/MovieService";

@Controller({ version: "1" })
export class GetMovieLocationStatisticsController {
  constructor(private readonly movies: MovieService) {}

  @Get("/metadata/movies/stats/locations")
  @ApiOperation({
    summary: "Gets movie location statistics",
    description:
      "Gets the location statistics for movies.  This API reports the counts for each country where a movie has" +
      "a production location.",
    operationId: "GetMovieLocationStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieLocationStatisticsResponse,
    description: "The list of movie recommendations.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetMovieLocationStatisticsResponse = {
      statistics: await this.movies.getLocationStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
