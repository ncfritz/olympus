import { ListWeatherLocationsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
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
import { WeatherLocationService } from "../services/WeatherLocationService";

/** The caller's own locations; whose is never a parameter. */
@Controller({ version: "1" })
export class ListWeatherLocationsController {
  constructor(private readonly weatherLocations: WeatherLocationService) {}

  @Get("/weather/locations")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's weather locations",
    description:
      "Every place the caller keeps a forecast for, in the order they arranged them.",
    operationId: "ListWeatherLocations",
    tags: ["Weather"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: ListWeatherLocationsResponse,
    description: "The caller's locations.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListWeatherLocationsResponse = {
      weatherLocations: await this.weatherLocations.list(user.userId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
