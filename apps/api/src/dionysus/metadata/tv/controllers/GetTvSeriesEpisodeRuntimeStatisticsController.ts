import { GetTvSeriesEpisodeStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { TvSeriesService } from "../services/TvSeriesService";

@Controller({ version: "1" })
export class GetTvSeriesEpisodeRuntimeStatisticsController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Get("/metadata/tv/series/stats/runtime")
  @ApiOperation({
    summary: "Gets a histogram of runtimes for TV series episodes",
    description:
      "Gets a histogram of TV series episode runtimes.  This excludes any runtimes greater than 6H.",
    operationId: "GetTvSeriesEpisodeRuntimeStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesEpisodeStatisticsResponse,
    description: "The histogram of movie runtimes.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetTvSeriesEpisodeStatisticsResponse = {
      statistics: await this.tvSeries.getEpisodeRuntimeStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
