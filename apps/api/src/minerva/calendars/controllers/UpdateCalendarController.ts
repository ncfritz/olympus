import {
  EmptyResponse,
  SingleCalendarResponse,
  UpdateCalendarRequest,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { CalendarService } from "../services/CalendarService";

@Controller({ version: "1" })
export class UpdateCalendarController {
  constructor(private readonly calendars: CalendarService) {}

  @Put("/calendar/:calendarId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes one of the signed-in user's synced calendars",
    description:
      "Pauses or resumes a calendar's sync, or counts its events toward availability or not. Another user's calendar is not found.",
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
    description: "Input for the UpdateCalendar operation",
  })
  @ApiOkResponse({
    type: SingleCalendarResponse,
    description: "The calendar with the changes applied.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The request named nothing to change.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("calendarId") calendarId: string,
    @Body() request: UpdateCalendarRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const changes = request?.calendar ?? {};
    if (changes.enabled === undefined && changes.includedInBusy === undefined) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: SingleCalendarResponse = {
      calendar: await this.calendars.update(user.userId, calendarId, changes),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
