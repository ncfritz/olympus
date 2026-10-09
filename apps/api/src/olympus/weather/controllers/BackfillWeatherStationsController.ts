import {
  BackfillWeatherStationsRequest,
  EmptyResponse,
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
  toBackfillRequest,
  WeatherBackfillService,
} from "../services/WeatherBackfillService";

@Controller({ version: "1" })
export class BackfillWeatherStationsController {
  constructor(private readonly backfills: WeatherBackfillService) {}

  @Post("/weather/stations/backfill")
  @RequiresIdentity()
  @Roles("admin")
  @ApiOperation({
    summary: "Backfills weather stations from ambientweather.net",
    description:
      "Fetches a range of UTC days of the stations' history (5-minute steps) from ambientweather.net, archives each response and stores its records, never replacing a pushed sample; then rebuilds the tiers for those days. " +
      "Runs in the background; its summary is logged. Gaps within the samples' retention are filled hourly without asking; this is for older history. Only where WEATHER_BACKFILL_ENABLED and the Ambient keys are set.",
    operationId: "BackfillWeatherStations",
    tags: ["Weather"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: BackfillWeatherStationsRequest,
    required: true,
    description: "Input for the BackfillWeatherStations operation",
  })
  @ApiAcceptedResponse({
    type: EmptyResponse,
    description: "The backfill has started.",
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
    description: "Backfill is off here, or one is already running.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: BackfillWeatherStationsRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.backfills.start(toBackfillRequest(request?.backfill));
    const body: EmptyResponse = {};
    response.status(HttpStatus.ACCEPTED).send(body);
  }
}
