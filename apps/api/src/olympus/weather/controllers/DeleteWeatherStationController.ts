import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { WeatherStationService } from "../services/WeatherStationService";

@Controller({ version: "1" })
export class DeleteWeatherStationController {
  constructor(private readonly weatherStations: WeatherStationService) {}

  @Delete("/weather/station/:stationId")
  @RequiresIdentity()
  @Roles("admin")
  @ApiOperation({
    summary: "Removes a weather station",
    description:
      "Unregisters a station and removes its samples. Its raw archive on disk is kept; registering the console again and replaying restores them.",
    operationId: "DeleteWeatherStation",
    tags: ["Weather"],
  })
  @ApiParam({
    name: "stationId",
    description: "The ID of the station to remove",
    type: String,
  })
  @ApiNoContentResponse({ description: "The station was removed." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The caller is not an admin.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("stationId", ParseUUIDPipe) stationId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.weatherStations.delete(stationId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
