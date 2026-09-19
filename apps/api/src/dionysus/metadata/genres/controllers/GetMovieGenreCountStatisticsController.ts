import { GetMovieGenreCountStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { GenreService } from "../services/GenreService";

@Controller({ version: "1" })
export class GetMovieGenreCountStatisticsController {
  constructor(private readonly genres: GenreService) {}

  @Get("/metadata/genres/stats/counts/movies")
  @ApiOperation({
    summary: "Gets a histogram of the number of genres associated with movies",
    description:
      "Gets a histogram of the number of genres associated with movies.",
    operationId: "GetMovieGenreCountStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieGenreCountStatisticsResponse,
    description: "The histogram of genre counts.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetMovieGenreCountStatisticsResponse = {
      statistics: await this.genres.getMovieGenreCountStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
