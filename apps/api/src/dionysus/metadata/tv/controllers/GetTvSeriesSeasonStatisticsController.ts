import { GetTvSeriesSeasonStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { TvSeriesService } from "../services/TvSeriesService";

@Controller({ version: "1" })
export class GetTvSeriesSeasonStatisticsController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Get("/metadata/tv/series/stats/seasons")
  @ApiOperation({
    summary: "Gets a histogram of season counts for TV series",
    description: "Gets a map of year to the number of seasons for TV series.",
    operationId: "GetTvSeriesSeasonStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesSeasonStatisticsResponse,
    description:
      "The list off years to the count of movies released that year.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetTvSeriesSeasonStatisticsResponse = {
      statistics: await this.tvSeries.getSeasonStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
