import { GetMovieAggregateStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MovieService } from "../services/MovieService";

@Controller({ version: "1" })
export class GetMovieAggregateStatisticsController {
  constructor(private readonly movies: MovieService) {}

  @Get("/metadata/movies/stats/aggregate")
  @ApiOperation({
    summary: "Gets movie aggregate statistics",
    description: "Gets the aggregate statistics for movies.",
    operationId: "GetMovieAggregateStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieAggregateStatisticsResponse,
    description: "The aggregate statistics for movies.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetMovieAggregateStatisticsResponse =
      await this.movies.getAggregateStatistics();

    response.status(HttpStatus.OK).send(responseBody);
  }
}
