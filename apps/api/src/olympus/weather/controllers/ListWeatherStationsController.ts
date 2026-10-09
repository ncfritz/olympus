import { ListWeatherStationsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { WeatherStationService } from "../services/WeatherStationService";

/** The house's stations: shared by every signed-in user. */
@Controller({ version: "1" })
export class ListWeatherStationsController {
  constructor(private readonly weatherStations: WeatherStationService) {}

  @Get("/weather/stations")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the weather stations",
    description: "Every registered weather station, by name.",
    operationId: "ListWeatherStations",
    tags: ["Weather"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: ListWeatherStationsResponse,
    description: "The registered stations.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const body: ListWeatherStationsResponse = {
      weatherStations: await this.weatherStations.list(),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
