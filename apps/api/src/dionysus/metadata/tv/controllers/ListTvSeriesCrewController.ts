import { ListTvSeriesCrewResponse } from "@ncfritz/olympus-model";
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
export class ListTvSeriesCrewController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Get("/metadata/tvSeries/:tvSeriesId/crew")
  @ApiOperation({
    summary: "Lists TV series crew members",
    description:
      "Lists the full crew for a TV series.  This API is not paginated and does not support filtering.",
    operationId: "ListTvSeriesCrew",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListTvSeriesCrewResponse,
    description: "The list of tvSeries crew members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListTvSeriesCrewResponse = {
      crew: await this.tvSeries.listCrew(tvSeriesId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
