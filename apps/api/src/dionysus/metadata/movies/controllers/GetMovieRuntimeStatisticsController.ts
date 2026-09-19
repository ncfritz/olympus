import { GetMovieRuntimeStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MovieService } from "../services/MovieService";

@Controller({ version: "1" })
export class GetMovieRuntimeStatisticsController {
  constructor(private readonly movies: MovieService) {}

  @Get("/metadata/movies/stats/runtime")
  @ApiOperation({
    summary: "Gets a histogram of runtimes for movies",
    description:
      "Gets a histogram of movie runtimes.  This excludes any runtimes greater than 6H.",
    operationId: "GetMovieRuntimeStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieRuntimeStatisticsResponse,
    description: "The histogram of movie runtimes.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetMovieRuntimeStatisticsResponse = {
      statistics: await this.movies.getRuntimeStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
