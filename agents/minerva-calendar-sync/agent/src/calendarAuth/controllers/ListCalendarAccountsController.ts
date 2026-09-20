import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ListCalendarAccountsResponse } from "../../model/calendarAccounts";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarAccountService } from "../services/CalendarAccountService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListCalendarAccountsController {
  constructor(private readonly calendarAccounts: CalendarAccountService) {}

  @Get("/calendar-accounts")
  @ApiOperation({
    summary: "Lists calendar accounts",
    description:
      "Returns every calendar account, connected or only configured, with its credential's status.",
    operationId: "ListCalendarAccounts",
    tags: ["Calendar Accounts"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The accounts were listed.",
    type: ListCalendarAccountsResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
  })
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ListCalendarAccountsResponse = {
      calendarAccounts: await this.calendarAccounts.list(),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
