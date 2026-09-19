import { GetTvSeriesLocationStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { TvSeriesService } from "../services/TvSeriesService";

@Controller({ version: "1" })
export class GetTvSeriesLocationStatisticsController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Get("/metadata/tv/series/stats/locations")
  @ApiOperation({
    summary: "Gets TV series location statistics",
    description:
      "Gets the location statistics for TV series.  This API reports the counts for each country where a movie has" +
      "a production location.",
    operationId: "GetTvSeriesLocationStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesLocationStatisticsResponse,
    description: "The list of movie recommendations.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetTvSeriesLocationStatisticsResponse = {
      statistics: await this.tvSeries.getLocationStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
