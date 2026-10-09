import { ListAvailableCalendarsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
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
export class ListAvailableCalendarsController {
  constructor(private readonly calendars: CalendarService) {}

  @Get("/calendar-account/:accountId/available")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the calendars of one of the user's calendar accounts",
    description:
      "Returns every calendar the account's provider reports, synced or not, to choose one to add.",
    operationId: "ListAvailableCalendars",
    tags: ["Calendars"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The ID of the account",
    type: String,
  })
  @ApiOkResponse({
    type: ListAvailableCalendarsResponse,
    description: "The account's calendars.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListAvailableCalendarsResponse = {
      availableCalendars: await this.calendars.listAvailable(
        user.userId,
        accountId,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
