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
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { WeatherLocationService } from "../services/WeatherLocationService";

@Controller({ version: "1" })
export class DeleteWeatherLocationController {
  constructor(private readonly weatherLocations: WeatherLocationService) {}

  @Delete("/weather/location/:locationId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Removes one of the signed-in user's weather locations",
    description:
      "Removes a location from the caller's list. Removing the default leaves none; the widget then opens on the first location.",
    operationId: "DeleteWeatherLocation",
    tags: ["Weather"],
  })
  @ApiParam({
    name: "locationId",
    description: "The ID of the location to remove",
    type: String,
  })
  @ApiNoContentResponse({ description: "The location was removed." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("locationId", ParseUUIDPipe) locationId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.weatherLocations.delete(user.userId, locationId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
