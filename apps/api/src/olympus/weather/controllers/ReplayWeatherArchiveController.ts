import {
  EmptyResponse,
  ReplayWeatherArchiveRequest,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import {
  toReplayRequest,
  WeatherReplayService,
} from "../services/WeatherReplayService";

@Controller({ version: "1" })
export class ReplayWeatherArchiveController {
  constructor(private readonly replays: WeatherReplayService) {}

  @Post("/weather/archive/replay")
  @RequiresIdentity()
  @Roles("admin")
  @ApiOperation({
    summary: "Replays the raw station archive",
    description:
      "Loads a range of UTC days from this API's station archive again: each line parsed and stored, then every tier rebuilt for the day and retention applied. " +
      "Runs in the background; its summary is logged. One replay at a time. For another archive (the NAS copy, prod's from dev) use weather:replay.",
    operationId: "ReplayWeatherArchive",
    tags: ["Weather"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ReplayWeatherArchiveRequest,
    required: true,
    description: "Input for the ReplayWeatherArchive operation",
  })
  @ApiAcceptedResponse({
    type: EmptyResponse,
    description: "The replay has started.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The caller is not an admin.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "A replay is already running.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: ReplayWeatherArchiveRequest,
    @Res() response: Response,
  ): Promise<void> {
    this.replays.start(toReplayRequest(request?.replay));
    const body: EmptyResponse = {};
    response.status(HttpStatus.ACCEPTED).send(body);
  }
}
