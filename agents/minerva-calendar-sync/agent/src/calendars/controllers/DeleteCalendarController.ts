import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarService } from "../services/CalendarService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DeleteCalendarController {
  constructor(private readonly calendars: CalendarService) {}

  @Delete("/calendar/:calendarId")
  @ApiOperation({
    summary: "Deletes a calendar",
    description: "Stops syncing a calendar; its events stay stored.",
    operationId: "DeleteCalendar",
    tags: ["Calendars"],
  })
  @ApiParam({
    name: "calendarId",
    description: "The provider's ID of the calendar",
    type: String,
  })
  @ApiNoContentResponse({ description: "The calendar is no longer synced." })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.BAD_REQUEST] })
  async handle(
    @Param("calendarId") calendarId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.calendars.delete(calendarId);
    response.status(HttpStatus.NO_CONTENT).end();
  }
}
