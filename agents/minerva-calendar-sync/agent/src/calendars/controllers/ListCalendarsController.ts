import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ListCalendarsResponse } from "../../model/calendars";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarService } from "../services/CalendarService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListCalendarsController {
  constructor(private readonly calendars: CalendarService) {}

  @Get("/calendars")
  @ApiOperation({
    summary: "Lists calendars",
    description:
      "Returns every synced calendar with its settings and sync status.",
    operationId: "ListCalendars",
    tags: ["Calendars"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The calendars were listed.",
    type: ListCalendarsResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
  })
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ListCalendarsResponse = {
      calendars: await this.calendars.list(),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
