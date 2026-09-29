import {
  EmptyResponse,
  UpdateWeatherLocationRequest,
  UpdateWeatherLocationResponse,
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
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { WeatherLocationService } from "../services/WeatherLocationService";

@Controller({ version: "1" })
export class UpdateWeatherLocationController {
  constructor(private readonly weatherLocations: WeatherLocationService) {}

  @Put("/weather/location/:locationId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes one of the signed-in user's weather locations",
    description:
      "Relabels a location, or makes it the default, which clears the previous default. The place itself cannot change: a different place is a new location.",
    operationId: "UpdateWeatherLocation",
    tags: ["Weather"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "locationId",
    description: "The ID of the location to change",
    type: String,
  })
  @ApiBody({
    type: UpdateWeatherLocationRequest,
    required: true,
    description: "Input for the UpdateWeatherLocation operation",
  })
  @ApiOkResponse({
    type: UpdateWeatherLocationResponse,
    description: "The location with the changes applied.",
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
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("locationId", ParseUUIDPipe) locationId: string,
    @Body() request: UpdateWeatherLocationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const weatherLocation = await this.weatherLocations.update(
      user.userId,
      locationId,
      request?.weatherLocation,
    );
    if (!weatherLocation) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: UpdateWeatherLocationResponse = { weatherLocation };
    response.status(HttpStatus.OK).send(body);
  }
}
