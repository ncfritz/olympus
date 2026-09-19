import { GetMovieReleaseStatusStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MovieService } from "../services/MovieService";

@Controller({ version: "1" })
export class GetMovieReleaseStatusStatisticsController {
  constructor(private readonly movies: MovieService) {}

  @Get("/metadata/movies/stats/releaseStatus")
  @ApiOperation({
    summary: "Gets movie release status statistics",
    description: "Gets the release status statistics for movies.",
    operationId: "GetMovieReleaseStatusStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieReleaseStatusStatisticsResponse,
    description: "The list of status statistics.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetMovieReleaseStatusStatisticsResponse = {
      statistics: await this.movies.getReleaseStatusStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
