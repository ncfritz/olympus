import { DescribeTVSeasonResponse } from "@ncfritz/olympus-model";
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
export class DescribeTvSeasonController {
  constructor(private readonly tvSeasons: TvSeasonService) {}

  @Get("/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber")
  @ApiOperation({
    summary: "Describes a TV season in Dionysus",
    description: "Retrieves the details of a TV season in Dionysus.",
    operationId: "DescribeTvSeason",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    description: "The ID of the TV series the season is associated with",
    type: Number,
  })
  @ApiParam({
    name: "seasonNumber",
    description: "The season number to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeTVSeasonResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeTVSeasonResponse = {
      season: await this.tvSeasons.describe(tvSeriesId, seasonNumber),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
