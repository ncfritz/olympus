import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
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
export class RemoveCalendarController {
  constructor(private readonly calendars: CalendarService) {}

  @Delete("/calendar/:calendarId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Stops syncing one of the signed-in user's calendars",
    description:
      "Removes a calendar from the ones the sync agent keeps in Minerva; its meetings stay. Another user's calendar is not found.",
    operationId: "RemoveCalendar",
    tags: ["Calendars"],
  })
  @ApiParam({
    name: "calendarId",
    description: "The provider's ID of the calendar",
    type: String,
  })
  @ApiNoContentResponse({ description: "The calendar is no longer synced." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("calendarId") calendarId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.calendars.remove(user.userId, calendarId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
