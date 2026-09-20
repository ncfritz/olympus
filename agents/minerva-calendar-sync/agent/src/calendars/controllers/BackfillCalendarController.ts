import { Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { BackfillCalendarResponse } from "../../model/calendars";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarService } from "../services/CalendarService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class BackfillCalendarController {
  constructor(private readonly calendars: CalendarService) {}

  @Post("/calendar/:calendarId/backfill")
  @ApiOperation({
    summary: "Backfills a calendar",
    description:
      "Enqueues a calendar's current events for publishing again, to seed or repair a downstream copy.",
    operationId: "BackfillCalendar",
    tags: ["Calendars"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "calendarId",
    description: "The provider's ID of the calendar",
    type: String,
  })
  @ApiOkResponse({
    description: "The events were enqueued.",
    type: BackfillCalendarResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.CONFLICT],
  })
  async handle(
    @Param("calendarId") calendarId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: BackfillCalendarResponse = {
      backfill: await this.calendars.backfill(calendarId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
