import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  CreateCalendarRequest,
  CreateCalendarResponse,
} from "../../model/calendars";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarService } from "../services/CalendarService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateCalendarController {
  constructor(private readonly calendars: CalendarService) {}

  @Post("/calendars")
  @ApiOperation({
    summary: "Creates a calendar",
    description:
      "Starts syncing a calendar of a connected account; its first sync runs in the background.",
    operationId: "CreateCalendar",
    tags: ["Calendars"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCalendarRequest,
    required: true,
    description: "The calendar to add.",
  })
  @ApiCreatedResponse({
    description: "The calendar was added.",
    type: CreateCalendarResponse,
  })
  @ApiStandardErrorResponses({ include: [HttpStatus.CONFLICT] })
  async handle(
    @Body() request: CreateCalendarRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateCalendarResponse = {
      calendar: await this.calendars.create(request.calendar),
    };
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
