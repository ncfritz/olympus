import {
  Controller,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
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
  ReauthorizeCalendarAccountResponse,
} from "../../model/calendarAccounts";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarAccountService } from "../services/CalendarAccountService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ReauthorizeCalendarAccountController {
  constructor(private readonly calendarAccounts: CalendarAccountService) {}

  @Post("/calendar-account/:accountLabel/reauthorize")
  @ApiOperation({
    summary: "Reauthorizes a calendar account",
    description:
      "Starts a sign-in that renews the access of an account whose credential expired.",
    operationId: "ReauthorizeCalendarAccount",
    tags: ["Calendar Accounts"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountLabel",
    description: "The account's label",
    type: String,
  })
  @ApiOkResponse({
    description: "The reauthorization was started.",
    type: ReauthorizeCalendarAccountResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("accountLabel") accountLabel: string,
    @Query() query: CalendarAccountProviderQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ReauthorizeCalendarAccountResponse = {
      reauthorization: await this.calendarAccounts.reauthorize(
        accountLabel,
        query.provider,
      ),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
