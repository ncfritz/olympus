import { GetTvSeriesFirstAirYearStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { TvSeriesService } from "../services/TvSeriesService";

@Controller({ version: "1" })
export class GetTvSeriesFirstAirYearStatisticsController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Get("/metadata/tv/series/stats/firstAirYear")
  @ApiOperation({
    summary: "Gets a histogram of first air years for TV series",
    description:
      "Gets a map of year to the number of TV series that first aired that year.",
    operationId: "GetTvSeriesFirstAirYearStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetTvSeriesFirstAirYearStatisticsResponse,
    description:
      "The list off years to the count of movies released that year.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetTvSeriesFirstAirYearStatisticsResponse = {
      statistics: await this.tvSeries.getFirstAirYearStatistics(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
