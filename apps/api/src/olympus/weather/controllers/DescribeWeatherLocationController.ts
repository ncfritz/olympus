import { DescribeWeatherLocationResponse } from "@ncfritz/olympus-model";
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
import { WeatherLocationService } from "../services/WeatherLocationService";

@Controller({ version: "1" })
export class DescribeWeatherLocationController {
  constructor(private readonly weatherLocations: WeatherLocationService) {}

  @Get("/weather/location/:locationId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes one of the signed-in user's weather locations",
    description:
      "Returns a single location of the caller's. Another user's location is not found.",
    operationId: "DescribeWeatherLocation",
    tags: ["Weather"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "locationId",
    description: "The ID of the location",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeWeatherLocationResponse,
    description: "The location was found.",
  })
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
    const body: DescribeWeatherLocationResponse = {
      weatherLocation: await this.weatherLocations.describe(
        user.userId,
        locationId,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
