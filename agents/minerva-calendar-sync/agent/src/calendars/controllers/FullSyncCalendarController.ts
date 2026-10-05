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
export class FullSyncCalendarController {
  constructor(private readonly calendars: CalendarService) {}

  @Post("/calendar/:calendarId/full-sync")
  @ApiOperation({
    summary: "Syncs a calendar's whole history",
    description:
      "Starts a full sync of a calendar from its first event, in the background, rather than over the sync window's past days. Refused while the calendar is syncing.",
    operationId: "FullSyncCalendar",
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
    description: "The full sync was started.",
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.BAD_REQUEST] })
  async handle(
    @Param("calendarId") calendarId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.calendars.fullSync(calendarId);
    response.status(HttpStatus.ACCEPTED).end();
  }
}
