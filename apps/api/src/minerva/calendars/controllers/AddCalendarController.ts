import {
  AddCalendarRequest,
  SingleCalendarResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
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
export class AddCalendarController {
  constructor(private readonly calendars: CalendarService) {}

  @Post("/calendar-account/:accountId/calendars")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Starts syncing a calendar of one of the user's accounts",
    description:
      "Adds a calendar of the account, from ListAvailableCalendars, to the ones the sync agent keeps in Minerva; its first sync runs in the background.",
    operationId: "AddCalendar",
    tags: ["Calendars"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The ID of the account",
    type: String,
  })
  @ApiBody({
    type: AddCalendarRequest,
    required: true,
    description: "Input for the AddCalendar operation",
  })
  @ApiCreatedResponse({
    type: SingleCalendarResponse,
    description: "The calendar is synced.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      "The calendar is already synced, or another calendar has the source.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Body() request: AddCalendarRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: SingleCalendarResponse = {
      calendar: await this.calendars.add(
        user.userId,
        accountId,
        request?.calendar?.calendarId,
        request?.calendar?.source,
      ),
    };
    response.status(HttpStatus.CREATED).send(body);
  }
}
