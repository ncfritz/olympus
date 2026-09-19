import { ListTvSeriesCastResponse } from "@ncfritz/olympus-model";
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
export class ListTvSeriesCastController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Get("/metadata/tvSeries/:tvSeriesId/cast")
  @ApiOperation({
    summary: "Lists TV series cast members",
    description:
      "Lists the full cast for a TV series.  This API is not paginated and does not support filtering.",
    operationId: "ListTvSeriesCast",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListTvSeriesCastResponse,
    description: "The list of tvSeries cast members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListTvSeriesCastResponse = {
      cast: await this.tvSeries.listCast(tvSeriesId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
