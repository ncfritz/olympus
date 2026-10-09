import {
  CreateWeatherStationRequest,
  CreateWeatherStationResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { setLocation } from "../../../utils/location";
import { WeatherStationService } from "../services/WeatherStationService";
import { DescribeWeatherStationController } from "./DescribeWeatherStationController";

@Controller({ version: "1" })
export class CreateWeatherStationController {
  constructor(private readonly weatherStations: WeatherStationService) {}

  @Post("/weather/stations")
  @RequiresIdentity()
  @Roles("admin")
  @ApiOperation({
    summary: "Registers a weather station",
    description:
      "Registers a console by its MAC address, which it sends as PASSKEY. Until it is registered, its pushes are refused.",
    operationId: "CreateWeatherStation",
    tags: ["Weather"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateWeatherStationRequest,
    required: true,
    description: "Input for the CreateWeatherStation operation",
  })
  @ApiCreatedResponse({
    type: CreateWeatherStationResponse,
    description: "The station was registered.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the registered station",
      },
    },
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
    @Body() request: CreateWeatherStationRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const weatherStation = await this.weatherStations.create(
      request?.weatherStation,
    );
    setLocation(response, httpRequest, DescribeWeatherStationController, {
      stationId: weatherStation.id,
    });
    const body: CreateWeatherStationResponse = { weatherStation };
    response.status(HttpStatus.CREATED).send(body);
  }
}
