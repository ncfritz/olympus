import { Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarService } from "../services/CalendarService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class SyncCalendarController {
  constructor(private readonly calendars: CalendarService) {}

  @Post("/calendar/:calendarId/sync")
  @ApiOperation({
    summary: "Syncs a calendar",
    description: "Starts a sync of a calendar now, in the background.",
    operationId: "SyncCalendar",
    tags: ["Calendars"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "calendarId",
    description: "The provider's ID of the calendar",
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: "The sync was started.",
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.BAD_REQUEST] })
  async handle(
    @Param("calendarId") calendarId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.calendars.sync(calendarId);
    response.status(HttpStatus.ACCEPTED).end();
  }
}
