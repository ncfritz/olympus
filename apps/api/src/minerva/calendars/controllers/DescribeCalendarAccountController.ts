import { DescribeCalendarAccountResponse } from "@ncfritz/olympus-model";
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
import { CalendarAccountService } from "../services/CalendarAccountService";

@Controller({ version: "1" })
export class DescribeCalendarAccountController {
  constructor(private readonly accounts: CalendarAccountService) {}

  @Get("/calendar-account/:accountId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes one of the signed-in user's calendar accounts",
    description:
      "Returns a calendar account of the caller's with its credential's state. Another user's account is not found.",
    operationId: "DescribeCalendarAccount",
    tags: ["Calendar Accounts"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The ID of the account",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeCalendarAccountResponse,
    description: "The account was found.",
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
    const body: DescribeCalendarAccountResponse = {
      calendarAccount: await this.accounts.describe(user.userId, accountId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
