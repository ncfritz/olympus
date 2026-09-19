import { GetTvSeriesStatusStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { TvSeriesService } from "../services/TvSeriesService";

@Controller({ version: "1" })
export class GetTvSeriesStatusStatisticsController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Get("/metadata/tv/series/stats/releaseStatus")
  @ApiOperation({
    summary: "Gets TV series release status statistics",
    description: "Gets the release status statistics for Tv series.",
    operationId: "GetTvSeriesStatusStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesStatusStatisticsResponse,
    description: "The list of status statistics.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetTvSeriesStatusStatisticsResponse = {
      statistics: await this.tvSeries.getStatusStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
