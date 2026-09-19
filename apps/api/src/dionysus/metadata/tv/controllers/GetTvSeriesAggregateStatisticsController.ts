import { GetTvSeriesAggregateStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { TvSeriesService } from "../services/TvSeriesService";

@Controller({ version: "1" })
export class GetTvSeriesAggregateStatisticsController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Get("/metadata/tv/series/stats/aggregate")
  @ApiOperation({
    summary: "Gets TV Series aggregate statistics",
    description: "Gets the aggregate statistics for TV series.",
    operationId: "GetTvSeriesAggregateStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesAggregateStatisticsResponse,
    description: "The aggregate statistics for TV series.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetTvSeriesAggregateStatisticsResponse =
      await this.tvSeries.getAggregateStatistics();

    response.status(HttpStatus.OK).send(responseBody);
  }
}
