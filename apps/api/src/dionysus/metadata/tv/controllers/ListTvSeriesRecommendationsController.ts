import { ListTvSeriesRecommendationsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { TvSeriesService } from "../services/TvSeriesService";

@Controller({ version: "1" })
export class ListTvSeriesRecommendationsController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Get("/metadata/tvSeries/:tvSeriesId/recommendations")
  @ApiOperation({
    summary: "Lists TV series recommendations",
    description:
      "Lists the recommendations for a TV series.  This API is not paginated and does not support filtering.",
    operationId: "ListTvSeriesRecommendations",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListTvSeriesRecommendationsResponse,
    description: "The list of TV series recommendations.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListTvSeriesRecommendationsResponse = {
      recommendations: await this.tvSeries.listRecommendations(tvSeriesId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
