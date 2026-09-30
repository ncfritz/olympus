import { EmptyResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Req, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { Public } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { StationReportService } from "../services/StationReportService";

/**
 * Where a WS-5000's Customized upload lands. Public, because a console
 * cannot sign in: it is let in by where it is (the allowed ranges, and a
 * LAN-only listener in front) and by what it is (a registered MAC).
 */
@Controller({ version: "1" })
export class ReportWeatherStationReadingController {
  constructor(private readonly stationReports: StationReportService) {}

  @Get("/weather/station/report")
  @Public()
  @ApiOperation({
    summary: "Receives a weather station's reading",
    description:
      "The Ambient Weather Customized upload: a GET with every reading as a query parameter and the console's MAC address as PASSKEY. " +
      "Accepted only from WEATHER_STATION_ALLOWED_CIDRS and only for a registered station; archived as received, then stored. A repeated reading is stored once.",
    operationId: "ReportWeatherStationReading",
    tags: ["Weather"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "PASSKEY",
    required: true,
    type: String,
    description: "The console's MAC address",
  })
  @ApiQuery({
    name: "dateutc",
    required: true,
    type: String,
    description:
      "When the reading was taken, YYYY-MM-DD HH:mm:ss in UTC, or now",
  })
  @ApiOkResponse({
    type: EmptyResponse,
    description:
      "The reading was stored, or was a repeat of one already stored.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not from an allowed address, or not a registered station.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const at = httpRequest.originalUrl.indexOf("?");
    await this.stationReports.report({
      query: httpRequest.query as Record<string, unknown>,
      rawQuery: at < 0 ? "" : httpRequest.originalUrl.slice(at + 1),
      remoteAddress: httpRequest.ip,
    });
    const body: EmptyResponse = {};
    response.status(HttpStatus.OK).send(body);
  }
}
