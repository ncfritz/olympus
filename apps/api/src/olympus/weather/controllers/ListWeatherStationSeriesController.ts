import { ListWeatherStationSeriesResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import {
  toSeriesRequest,
  WeatherSeriesService,
} from "../services/WeatherSeriesService";

@Controller({ version: "1" })
export class ListWeatherStationSeriesController {
  constructor(private readonly series: WeatherSeriesService) {}

  @Get("/weather/station/:stationId/series")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists a weather station's history as series",
    description:
      "For each metric asked for, the buckets of one tier across a range: count, average, minimum, maximum, sum, first and last. " +
      "wind_direction is the direction of each bucket's average wind. With resolution auto (the default) the tier is the finest that still holds the range's start and fits it in 2,000 points; 1d (whole UTC days, combined from the hourly tier) is the coarsest.",
    operationId: "ListWeatherStationSeries",
    tags: ["Weather"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "stationId",
    description: "The ID of the station",
    type: String,
  })
  @ApiQuery({
    name: "metrics",
    required: true,
    type: String,
    description:
      "Comma-separated metric names, e.g. outdoor_temperature,rain,wind_direction",
  })
  @ApiQuery({
    name: "from",
    required: true,
    type: String,
    description: "The range's start, an ISO-8601 time",
  })
  @ApiQuery({
    name: "to",
    required: true,
    type: String,
    description: "The range's end (exclusive), an ISO-8601 time",
  })
  @ApiQuery({
    name: "resolution",
    required: false,
    type: String,
    description:
      "auto (the default), a tier (1m, 5m, 15m, 30m, 1h), or 1d: whole UTC days",
  })
  @ApiOkResponse({
    type: ListWeatherStationSeriesResponse,
    description: "The series, one per metric, in the order asked.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("stationId", ParseUUIDPipe) stationId: string,
    @Query("metrics") metrics: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("resolution") resolution: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const body: ListWeatherStationSeriesResponse = {
      weatherStationSeries: await this.series.series(
        stationId,
        toSeriesRequest({ metrics, from, to, resolution }),
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
