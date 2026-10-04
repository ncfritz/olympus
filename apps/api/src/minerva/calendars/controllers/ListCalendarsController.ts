import { ListCalendarsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
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
export class ListCalendarsController {
  constructor(private readonly calendars: CalendarService) {}

  @Get("/calendars")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's synced calendars",
    description:
      "Returns every calendar of the caller's accounts that the sync agent keeps in Minerva, with its settings and sync state.",
    operationId: "ListCalendars",
    tags: ["Calendars"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: ListCalendarsResponse,
    description: "The caller's calendars.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListCalendarsResponse = {
      calendars: await this.calendars.list(user.userId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
