import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { DescribeCalendarAccountAuthorizationResponse } from "../../model/calendarAccounts";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarAccountService } from "../services/CalendarAccountService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeCalendarAccountAuthorizationController {
  constructor(private readonly calendarAccounts: CalendarAccountService) {}

  @Get("/calendar-account-authorization/:authorizationId")
  @ApiOperation({
    summary: "Describes a calendar account authorization",
    description:
      "Returns the outcome so far of a sign-in that connects a new account.",
    operationId: "DescribeCalendarAccountAuthorization",
    tags: ["Calendar Accounts"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "authorizationId",
    description: "The ID of the authorization",
    type: String,
  })
  @ApiOkResponse({
    description: "The authorization was found.",
    type: DescribeCalendarAccountAuthorizationResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.BAD_REQUEST] })
  async handle(
    @Param("authorizationId") authorizationId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeCalendarAccountAuthorizationResponse = {
      calendarAccountAuthorization:
        await this.calendarAccounts.describeAuthorization(authorizationId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
