import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  UpdateCalendarRequest,
  UpdateCalendarResponse,
} from "../../model/calendars";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarService } from "../services/CalendarService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class UpdateCalendarController {
  constructor(private readonly calendars: CalendarService) {}

  @Put("/calendar/:calendarId")
  @ApiOperation({
    summary: "Updates a calendar",
    description:
      "Changes whether a calendar syncs and whether its events count toward the computed availability.",
    operationId: "UpdateCalendar",
    tags: ["Calendars"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "calendarId",
    description: "The provider's ID of the calendar",
    type: String,
  })
  @ApiBody({
    type: UpdateCalendarRequest,
    required: true,
    description: "The settings to change.",
  })
  @ApiOkResponse({
    description: "The calendar was updated.",
    type: UpdateCalendarResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("calendarId") calendarId: string,
    @Body() request: UpdateCalendarRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateCalendarResponse = {
      calendar: await this.calendars.update(calendarId, request.calendar),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
