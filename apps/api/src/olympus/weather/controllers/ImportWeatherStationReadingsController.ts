import {
  ImportWeatherStationReadingsRequest,
  ImportWeatherStationReadingsResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import {
  toIngestLines,
  WeatherIngestService,
} from "../services/WeatherIngestService";

@Controller({ version: "1" })
export class ImportWeatherStationReadingsController {
  constructor(private readonly ingest: WeatherIngestService) {}

  @Post("/weather/station/readings")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Imports archived weather station lines",
    description:
      "Stores raw archive lines another environment received: each parsed with this API's parser and stored unless this environment already has the reading. " +
      "For the dev relay agent (ADR 0025). No address check and no archive write: the lines were checked and archived where they arrived. Lines from a station this environment has not registered are counted and skipped.",
    operationId: "ImportWeatherStationReadings",
    tags: ["Weather"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ImportWeatherStationReadingsRequest,
    required: true,
    description: "Input for the ImportWeatherStationReadings operation",
  })
  @ApiOkResponse({
    type: ImportWeatherStationReadingsResponse,
    description: "What became of the lines.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No client certificate, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The caller is not an agent.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: ImportWeatherStationReadingsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const { counts } = await this.ingest.ingest(
      toIngestLines(request?.records),
    );
    const body: ImportWeatherStationReadingsResponse = {
      stored: counts.stored,
      duplicate: counts.duplicate,
      unknownStation: counts.unknown_station,
      invalid: counts.invalid,
      skipped: counts.skipped,
    };
    response.status(HttpStatus.OK).send(body);
  }
}
