import {
  EmptyResponse,
  UpdateWeatherStationRequest,
  UpdateWeatherStationResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { WeatherStationService } from "../services/WeatherStationService";

@Controller({ version: "1" })
export class UpdateWeatherStationController {
  constructor(private readonly weatherStations: WeatherStationService) {}

  @Put("/weather/station/:stationId")
  @RequiresIdentity()
  @Roles("admin")
  @ApiOperation({
    summary: "Renames a weather station",
    description:
      "Changes a station's name. A different console is a different station: register it instead.",
    operationId: "UpdateWeatherStation",
    tags: ["Weather"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "stationId",
    description: "The ID of the station to change",
    type: String,
  })
  @ApiBody({
    type: UpdateWeatherStationRequest,
    required: true,
    description: "Input for the UpdateWeatherStation operation",
  })
  @ApiOkResponse({
    type: UpdateWeatherStationResponse,
    description: "The station with the changes applied.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The request named nothing to change.",
    type: EmptyResponse,
  })
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
    @Body() request: UpdateWeatherStationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const weatherStation = await this.weatherStations.update(
      stationId,
      request?.weatherStation,
    );
    if (!weatherStation) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: UpdateWeatherStationResponse = { weatherStation };
    response.status(HttpStatus.OK).send(body);
  }
}
