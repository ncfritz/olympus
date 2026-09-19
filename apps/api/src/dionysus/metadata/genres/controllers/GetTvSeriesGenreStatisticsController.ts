import { GetTvSeriesGenreStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { GenreService } from "../services/GenreService";

@Controller({ version: "1" })
export class GetTvSeriesGenreStatisticsController {
  constructor(private readonly genres: GenreService) {}

  @Get("/metadata/genres/stats/tvSeries")
  @ApiOperation({
    summary:
      "Gets a histogram of the number of TV series associated each genre",
    description:
      "Gets a histogram of the number of TV series associated with each genre.",
    operationId: "GetTvSeriesGenreStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesGenreStatisticsResponse,
    description: "The histogram of genre distributions.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetTvSeriesGenreStatisticsResponse = {
      statistics: await this.genres.getTvSeriesGenreStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
