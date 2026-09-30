import { DescribeWeatherStationResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { WeatherStationService } from "../services/WeatherStationService";

@Controller({ version: "1" })
export class DescribeWeatherStationController {
  constructor(private readonly weatherStations: WeatherStationService) {}

  @Get("/weather/station/:stationId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes a weather station",
    description: "Returns a single registered weather station.",
    operationId: "DescribeWeatherStation",
    tags: ["Weather"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "stationId",
    description: "The ID of the station",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeWeatherStationResponse,
    description: "The station was found.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("stationId", ParseUUIDPipe) stationId: string,
    @Res() response: Response,
  ): Promise<void> {
    const body: DescribeWeatherStationResponse = {
      weatherStation: await this.weatherStations.describe(stationId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
