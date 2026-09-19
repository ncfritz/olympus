import { ListTvSeasonCastResponse } from "@ncfritz/olympus-model";
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
import { TvSeasonService } from "../services/TvSeasonService";

@Controller({ version: "1" })
export class ListTvSeasonCastController {
  constructor(private readonly tvSeasons: TvSeasonService) {}

  @Get("/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber/cast")
  @ApiOperation({
    summary: "Lists TV season cast members",
    description:
      "Lists the full cast for a TV season.  This API is not paginated and does not support filtering.",
    operationId: "ListTvSeasonCast",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListTvSeasonCastResponse,
    description: "The list of tvSeries cast members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,

    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListTvSeasonCastResponse = {
      cast: await this.tvSeasons.listCast(tvSeriesId, seasonNumber),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
