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
  UpdateCalendarColorRequest,
  UpdateCalendarColorResponse,
} from "../../model/calendarColors";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarColorService } from "../services/CalendarColorService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class UpdateCalendarColorController {
  constructor(private readonly calendarColors: CalendarColorService) {}

  @Put("/calendar-color/:source")
  @ApiOperation({
    summary: "Updates a calendar color",
    description:
      "Sets the display color of a source label, including sources with no configured calendar such as the Overrides pseudo-source.",
    operationId: "UpdateCalendarColor",
    tags: ["Calendar Colors"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "source",
    description: "The source label to color",
    type: String,
  })
  @ApiBody({
    type: UpdateCalendarColorRequest,
    required: true,
    description: "The color to set.",
  })
  @ApiOkResponse({
    description: "The color was stored.",
    type: UpdateCalendarColorResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Param("source") source: string,
    @Body() request: UpdateCalendarColorRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateCalendarColorResponse = {
      calendarColor: await this.calendarColors.update(
        source,
        request.calendarColor.color,
      ),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
