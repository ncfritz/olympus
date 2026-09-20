import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ListCalendarColorsResponse } from "../../model/calendarColors";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarColorService } from "../services/CalendarColorService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListCalendarColorsController {
  constructor(private readonly calendarColors: CalendarColorService) {}

  @Get("/calendar-colors")
  @ApiOperation({
    summary: "Lists calendar colors",
    description:
      "Returns every display color the viewer has chosen, keyed by source label.",
    operationId: "ListCalendarColors",
    tags: ["Calendar Colors"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The colors were listed.",
    type: ListCalendarColorsResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
  })
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ListCalendarColorsResponse = {
      calendarColors: await this.calendarColors.list(),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
