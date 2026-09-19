import { GetMovieGenreStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { GenreService } from "../services/GenreService";

@Controller({ version: "1" })
export class GetMovieGenreStatisticsController {
  constructor(private readonly genres: GenreService) {}

  @Get("/metadata/genres/stats/movies")
  @ApiOperation({
    summary: "Gets a histogram of the number of movies associated each genre",
    description:
      "Gets a histogram of the number of movies associated with each genre.",
    operationId: "GetMovieGenreStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMovieGenreStatisticsResponse,
    description: "The histogram of genre distributions.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetMovieGenreStatisticsResponse = {
      statistics: await this.genres.getMovieGenreStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
