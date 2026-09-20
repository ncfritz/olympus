import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  CalendarAccountProviderQuery,
  ListAvailableCalendarsResponse,
} from "../../model/calendarAccounts";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarAccountService } from "../services/CalendarAccountService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListAvailableCalendarsController {
  constructor(private readonly calendarAccounts: CalendarAccountService) {}

  @Get("/calendar-account/:accountLabel/calendars")
  @ApiOperation({
    summary: "Lists an account's calendars",
    description:
      "Returns the calendars the provider reports for a connected account, marking those already synced.",
    operationId: "ListAvailableCalendars",
    tags: ["Calendar Accounts"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountLabel",
    description: "The account's label",
    type: String,
  })
  @ApiOkResponse({
    description: "The calendars were listed.",
    type: ListAvailableCalendarsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("accountLabel") accountLabel: string,
    @Query() query: CalendarAccountProviderQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListAvailableCalendarsResponse = {
      availableCalendars: await this.calendarAccounts.listAvailableCalendars(
        accountLabel,
        query.provider,
      ),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
