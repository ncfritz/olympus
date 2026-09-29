import { ListRadarFramesResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { WeatherTileService } from "../services/WeatherTileService";

@Controller({ version: "1" })
export class ListRadarFramesController {
  constructor(private readonly weatherTiles: WeatherTileService) {}

  @Get("/weather/radar/frames")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the past radar frames",
    description:
      "The last two hours of radar, ten minutes apart, oldest first. The list changes every ten minutes; a frame's ID is how its tiles are asked for.",
    operationId: "ListRadarFrames",
    tags: ["Weather"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: ListRadarFramesResponse,
    description: "The radar frames available now.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      "The provider is not answering, is rate limiting this server, or is not configured.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const body: ListRadarFramesResponse = {
      radarFrames: await this.weatherTiles.radarFrames(),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
