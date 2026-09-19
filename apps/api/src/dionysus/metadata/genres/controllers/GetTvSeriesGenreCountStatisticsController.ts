import { GetTvSeriesGenreCountStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { GenreService } from "../services/GenreService";

@Controller({ version: "1" })
export class GetTvSeriesGenreCountStatisticsController {
  constructor(private readonly genres: GenreService) {}

  @Get("/metadata/genres/stats/counts/tvSeries")
  @ApiOperation({
    summary:
      "Gets a histogram of the number of genres associated with TV series",
    description:
      "Gets a histogram of the number of genres associated with TV series.",
    operationId: "GetTvSeriesGenreCountStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesGenreCountStatisticsResponse,
    description: "The histogram of genre counts.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetTvSeriesGenreCountStatisticsResponse = {
      statistics: await this.genres.getTvSeriesGenreCountStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
