import {
  CreateWeatherLocationRequest,
  CreateWeatherLocationResponse,
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
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { setLocation } from "../../../utils/location";
import { WeatherLocationService } from "../services/WeatherLocationService";
import { DescribeWeatherLocationController } from "./DescribeWeatherLocationController";

@Controller({ version: "1" })
export class CreateWeatherLocationController {
  constructor(private readonly weatherLocations: WeatherLocationService) {}

  @Post("/weather/locations")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Adds a weather location for the signed-in user",
    description:
      "Adds a place to the end of the caller's list, usually one chosen in a Google place search. The first location a user adds becomes their default.",
    operationId: "CreateWeatherLocation",
    tags: ["Weather"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateWeatherLocationRequest,
    required: true,
    description: "Input for the CreateWeatherLocation operation",
  })
  @ApiCreatedResponse({
    type: CreateWeatherLocationResponse,
    description: "The location was added.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created weather location",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: CreateWeatherLocationRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const weatherLocation = await this.weatherLocations.create(
      user.userId,
      request?.weatherLocation,
    );
    setLocation(response, httpRequest, DescribeWeatherLocationController, {
      locationId: weatherLocation.id,
    });
    const body: CreateWeatherLocationResponse = { weatherLocation };
    response.status(HttpStatus.CREATED).send(body);
  }
}
