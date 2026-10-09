import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
} from "@nestjs/swagger";
import { CalendarAccountRemovalQuery } from "../../model/calendarAccounts";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarAccountService } from "../services/CalendarAccountService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DeleteCalendarAccountController {
  constructor(private readonly calendarAccounts: CalendarAccountService) {}

  @Delete("/calendar-account/:accountLabel")
  @ApiOperation({
    summary: "Deletes a calendar account",
    description:
      "Stops syncing every calendar of the account and deletes its stored credential; its events stay stored.",
    operationId: "DeleteCalendarAccount",
    tags: ["Calendar Accounts"],
  })
  @ApiParam({
    name: "accountLabel",
    description: "The account's label",
    type: String,
  })
  @ApiNoContentResponse({ description: "The account is no longer held." })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.BAD_REQUEST] })
  async handle(
    @Param("accountLabel") accountLabel: string,
    @Query() query: CalendarAccountRemovalQuery,
    @Res() response: Response,
  ): Promise<void> {
    await this.calendarAccounts.remove(accountLabel, query.provider);
    response.status(HttpStatus.NO_CONTENT).end();
  }
}
