import { ListTvSeasonCrewResponse } from "@ncfritz/olympus-model";
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
export class ListTvSeasonCrewController {
  constructor(private readonly tvSeasons: TvSeasonService) {}

  @Get("/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber/crew")
  @ApiOperation({
    summary: "Lists TV season crew members",
    description:
      "Lists the full crew for a TV season.  This API is not paginated and does not support filtering.",
    operationId: "ListTvSeasonCrew",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListTvSeasonCrewResponse,
    description: "The list of tvSeries crew members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,

    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListTvSeasonCrewResponse = {
      crew: await this.tvSeasons.listCrew(tvSeriesId, seasonNumber),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
