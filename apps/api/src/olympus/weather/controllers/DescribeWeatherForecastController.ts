import { DescribeWeatherForecastResponse } from "@ncfritz/olympus-model";
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
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { WeatherForecastService } from "../services/WeatherForecastService";

/**
 * By location, never by coordinate: the provider's allowance is only spent
 * on places someone keeps.
 */
@Controller({ version: "1" })
export class DescribeWeatherForecastController {
  constructor(private readonly weatherForecasts: WeatherForecastService) {}

  @Get("/weather/location/:locationId/forecast")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes the forecast for one of the signed-in user's locations",
    description:
      "The conditions now, the next 24 hours in 3-hour steps and five local days, from OpenWeather. " +
      "Forecasts are cached; while the provider is failing the last one fetched is returned marked stale, for a while.",
    operationId: "DescribeWeatherForecast",
    tags: ["Weather"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "locationId",
    description: "The ID of the location",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeWeatherForecastResponse,
    description: "The location's forecast, fresh or stale.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      "Forecasts are not configured, or the provider is failing and the last forecast is too old to show.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("locationId", ParseUUIDPipe) locationId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DescribeWeatherForecastResponse = {
      weatherForecast: await this.weatherForecasts.describe(
        user.userId,
        locationId,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
