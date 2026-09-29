import {
  ReorderWeatherLocationsRequest,
  ReorderWeatherLocationsResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
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

@Controller({ version: "1" })
export class ReorderWeatherLocationsController {
  constructor(private readonly weatherLocations: WeatherLocationService) {}

  @Put("/weather/locations/order")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Reorders the signed-in user's weather locations",
    description:
      "Puts the caller's locations in the order given. The list must name each of the caller's locations exactly once.",
    operationId: "ReorderWeatherLocations",
    tags: ["Weather"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ReorderWeatherLocationsRequest,
    required: true,
    description: "Input for the ReorderWeatherLocations operation",
  })
  @ApiOkResponse({
    type: ReorderWeatherLocationsResponse,
    description: "The locations were put in the new order.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: ReorderWeatherLocationsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ReorderWeatherLocationsResponse = {
      weatherLocations: await this.weatherLocations.reorder(
        user.userId,
        request?.locationIds,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
