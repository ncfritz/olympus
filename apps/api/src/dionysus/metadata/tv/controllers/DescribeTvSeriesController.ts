import { DescribeTVSeriesResponse } from "@ncfritz/olympus-model";
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
export class DescribeTvSeriesController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Get("/metadata/tvSeries/:tvSeriesId")
  @ApiOperation({
    summary: "Describes a TV series in Dionysus",
    description: "Retrieves the details of a TV series in Dionysus.",
    operationId: "DescribeTvSeries",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    description: "The ID of the TV series to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeTVSeriesResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeTVSeriesResponse = {
      tvSeries: await this.tvSeries.describe(tvSeriesId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
